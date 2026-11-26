-- =====================================================================
-- FatFit · Esquema de base de datos (PostgreSQL 16)
-- Una sola base con un esquema por microservicio. Cada servicio es dueño
-- de sus tablas: no hay llaves foráneas entre esquemas; el vínculo entre
-- servicios es usuario_id (el id de auth.usuarios que viaja en el JWT).
--
-- ATENCIÓN: este script BORRA y vuelve a crear todos los esquemas.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP SCHEMA IF EXISTS auth, salud, entrenamiento, nutricion, fati CASCADE;
CREATE SCHEMA auth;
CREATE SCHEMA salud;
CREATE SCHEMA entrenamiento;
CREATE SCHEMA nutricion;
CREATE SCHEMA fati;

-- =====================================================================
-- auth · cuentas, roles, consentimientos y tokens
-- =====================================================================

CREATE TABLE auth.usuarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL CHECK (length(trim(nombre)) >= 2),
  correo          text NOT NULL UNIQUE CHECK (correo = lower(correo)),
  contrasena_hash text NOT NULL,
  rol             text NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'profesionista', 'admin')),
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- Consentimiento explícito: términos y tratamiento de datos de salud, con la versión del aviso.
CREATE TABLE auth.consentimientos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('terminos', 'datos_salud')),
  version     text NOT NULL,
  aceptado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, tipo, version)
);

-- Tokens de refresco y de recuperación de contraseña. Solo se guarda el hash.
CREATE TABLE auth.tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES auth.usuarios (id) ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('refresco', 'recuperacion')),
  token_hash  text NOT NULL UNIQUE,
  expira_en   timestamptz NOT NULL,
  usado_en    timestamptz,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tokens_usuario_idx ON auth.tokens (usuario_id, tipo);

-- =====================================================================
-- salud · perfil inicial, condiciones, mediciones y recomendaciones
-- =====================================================================

CREATE TABLE salud.perfiles_salud (
  usuario_id           uuid PRIMARY KEY,
  edad                 smallint CHECK (edad BETWEEN 14 AND 100),
  sexo                 text CHECK (sexo IN ('mujer', 'hombre')),
  altura_cm            numeric(4,1) CHECK (altura_cm BETWEEN 100 AND 250),
  peso_inicial_kg      numeric(4,1) CHECK (peso_inicial_kg BETWEEN 30 AND 300),
  nivel_actividad      text CHECK (nivel_actividad IN ('sedentario', 'ligero', 'moderado', 'activo', 'muyActivo')),
  objetivo             text CHECK (objetivo IN ('bajar', 'mantener', 'ganar')),
  lugar                text NOT NULL DEFAULT 'casa' CHECK (lugar IN ('casa', 'casaEquipo', 'gimnasio', 'parque')),
  minutos              smallint NOT NULL DEFAULT 30 CHECK (minutos BETWEEN 10 AND 120),
  condicion_otra       text NOT NULL DEFAULT '',
  alimentos            text[] NOT NULL DEFAULT '{}',
  alimento_otro        text NOT NULL DEFAULT '',
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE salud.condiciones_salud (
  usuario_id uuid NOT NULL REFERENCES salud.perfiles_salud (usuario_id) ON DELETE CASCADE,
  condicion  text NOT NULL CHECK (condicion IN ('rodilla', 'lumbar', 'hipertension', 'diabetes', 'cardiopatia', 'embarazo')),
  PRIMARY KEY (usuario_id, condicion)
);

-- Un registro de peso por día.
CREATE TABLE salud.mediciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES salud.perfiles_salud (usuario_id) ON DELETE CASCADE,
  fecha      date NOT NULL,
  peso_kg    numeric(4,1) NOT NULL CHECK (peso_kg BETWEEN 30 AND 300),
  creado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, fecha)
);

-- Recomendaciones con su origen. Las de profesionista (fase 4) tienen prioridad.
CREATE TABLE salud.recomendaciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES salud.perfiles_salud (usuario_id) ON DELETE CASCADE,
  origen     text NOT NULL CHECK (origen IN ('reglas', 'fati', 'profesionista')),
  tipo       text NOT NULL,
  texto      text NOT NULL,
  vigente    boolean NOT NULL DEFAULT true,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recomendaciones_reglas_idx ON salud.recomendaciones (usuario_id, tipo) WHERE origen = 'reglas';

-- =====================================================================
-- entrenamiento · catálogo de ejercicios, rutinas y sesiones
-- =====================================================================

CREATE TABLE entrenamiento.ejercicios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL UNIQUE,
  tipo              text NOT NULL CHECK (tipo IN ('calentamiento', 'fuerza', 'cardio', 'estiramiento')),
  grupo_muscular    text NOT NULL CHECK (grupo_muscular IN ('piernas', 'gluteos', 'pecho', 'espalda', 'hombros', 'core', 'cuerpo_completo')),
  nivel             smallint NOT NULL CHECK (nivel BETWEEN 1 AND 3),          -- 1 principiante · 2 intermedio · 3 avanzado
  equipo            text NOT NULL CHECK (equipo IN ('ninguno', 'basico', 'gimnasio')),
  impacto           text NOT NULL CHECK (impacto IN ('bajo', 'alto')),
  al_aire_libre     boolean NOT NULL DEFAULT false,
  contraindicaciones text[] NOT NULL DEFAULT '{}',                             -- condiciones de salud que lo excluyen
  minutos           smallint NOT NULL DEFAULT 5 CHECK (minutos BETWEEN 1 AND 60),
  dosis             text NOT NULL,                                             -- «3 series × 10», «5 min»
  icono             text NOT NULL DEFAULT 'entrenar',
  activo            boolean NOT NULL DEFAULT true
);

CREATE TABLE entrenamiento.rutinas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL,
  nombre          text NOT NULL,
  minutos         smallint NOT NULL,
  equipo          text NOT NULL,
  nota            text NOT NULL,
  sesiones_semana smallint NOT NULL,
  parametros      jsonb NOT NULL,          -- datos del perfil con los que se generó
  activa          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX rutinas_activa_idx ON entrenamiento.rutinas (usuario_id) WHERE activa;

CREATE TABLE entrenamiento.rutina_ejercicios (
  rutina_id    uuid NOT NULL REFERENCES entrenamiento.rutinas (id) ON DELETE CASCADE,
  dia_semana   smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),          -- 1 lunes … 7 domingo
  orden        smallint NOT NULL,
  ejercicio_id uuid NOT NULL REFERENCES entrenamiento.ejercicios (id),
  dosis        text NOT NULL,
  PRIMARY KEY (rutina_id, dia_semana, orden)
);

-- Una sesión por día: qué ejercicios marcó el usuario y si la terminó.
CREATE TABLE entrenamiento.sesiones_completadas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id             uuid NOT NULL,
  rutina_id              uuid REFERENCES entrenamiento.rutinas (id) ON DELETE SET NULL,
  fecha                  date NOT NULL,
  ejercicios_completados uuid[] NOT NULL DEFAULT '{}',
  completada             boolean NOT NULL DEFAULT false,
  actualizado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, fecha)
);

-- =====================================================================
-- nutricion · catálogo de alimentos y registro de comidas
-- =====================================================================

CREATE TABLE nutricion.alimentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  marca          text,
  codigo_barras  text UNIQUE,
  origen         text NOT NULL DEFAULT 'local' CHECK (origen IN ('local', 'openfoodfacts', 'usda')),
  categoria      text NOT NULL DEFAULT 'otros',
  porcion        text NOT NULL,                       -- «1 pieza», «1 taza», «100 g»
  -- Valores por porción
  kcal           numeric(6,1) NOT NULL CHECK (kcal >= 0),
  proteina_g     numeric(5,1) NOT NULL DEFAULT 0 CHECK (proteina_g >= 0),
  carbos_g       numeric(5,1) NOT NULL DEFAULT 0 CHECK (carbos_g >= 0),
  grasa_g        numeric(5,1) NOT NULL DEFAULT 0 CHECK (grasa_g >= 0),
  sustituto_id   uuid REFERENCES nutricion.alimentos (id) ON DELETE SET NULL,   -- opción más ligera
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alimentos_nombre_idx ON nutricion.alimentos (lower(nombre) text_pattern_ops);

-- Cada registro guarda una copia de los valores para que el historial no cambie si se edita el catálogo.
CREATE TABLE nutricion.registros_comida (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL,
  fecha       date NOT NULL,
  tiempo      text NOT NULL CHECK (tiempo IN ('desayuno', 'comida', 'cena', 'colacion')),
  alimento_id uuid REFERENCES nutricion.alimentos (id) ON DELETE SET NULL,
  cantidad    numeric(5,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0 AND cantidad <= 50),   -- número de porciones
  nombre      text NOT NULL,
  porcion     text NOT NULL,
  kcal        numeric(7,1) NOT NULL,
  proteina_g  numeric(6,1) NOT NULL,
  carbos_g    numeric(6,1) NOT NULL,
  grasa_g     numeric(6,1) NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registros_usuario_fecha_idx ON nutricion.registros_comida (usuario_id, fecha);

-- =====================================================================
-- fati · planes, suscripciones, cuotas de IA, conversación y configuración
-- =====================================================================

-- La cuota de cada plan vive aquí: el administrador la cambia sin tocar código.
CREATE TABLE fati.planes (
  id                    text PRIMARY KEY CHECK (id IN ('basico', 'fatiMax', 'pro')),
  nombre                text NOT NULL,
  precio_mensual        numeric(8,2),                 -- NULL = gratis
  moneda                text NOT NULL DEFAULT 'MXN',
  cuota_fati            integer NOT NULL CHECK (cuota_fati >= 0),     -- peticiones por mes
  resumen               text NOT NULL,
  beneficios            text[] NOT NULL DEFAULT '{}',
  incluye_profesionista boolean NOT NULL DEFAULT false,
  orden                 smallint NOT NULL DEFAULT 0,
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fati.suscripciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL,
  plan_id      text NOT NULL REFERENCES fati.planes (id),
  estado       text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'terminada')),
  proveedor    text NOT NULL DEFAULT 'simulado' CHECK (proveedor IN ('simulado', 'stripe', 'revenuecat')),
  referencia   text,
  inicio       timestamptz NOT NULL DEFAULT now(),
  fin          timestamptz
);
CREATE UNIQUE INDEX suscripciones_activa_idx ON fati.suscripciones (usuario_id) WHERE estado = 'activa';

-- Peticiones a Fati por usuario y periodo (mes, 'AAAA-MM').
CREATE TABLE fati.uso_ia (
  usuario_id uuid NOT NULL,
  periodo    char(7) NOT NULL,
  peticiones integer NOT NULL DEFAULT 0 CHECK (peticiones >= 0),
  PRIMARY KEY (usuario_id, periodo)
);

CREATE TABLE fati.mensajes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid NOT NULL,
  de                  text NOT NULL CHECK (de IN ('usuario', 'fati')),
  texto               text NOT NULL,
  basado_en_calculos  boolean NOT NULL DEFAULT false,
  origen              text NOT NULL DEFAULT 'usuario' CHECK (origen IN ('usuario', 'llm', 'reglas', 'sistema')),
  creado_en           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_usuario_idx ON fati.mensajes (usuario_id, creado_en);

CREATE TABLE fati.configuracion (
  clave          text PRIMARY KEY,
  valor          jsonb NOT NULL,
  descripcion    text NOT NULL DEFAULT '',
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
