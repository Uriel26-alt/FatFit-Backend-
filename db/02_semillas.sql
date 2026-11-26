-- =====================================================================
-- FatFit · Datos iniciales: planes, configuración y catálogos
-- =====================================================================

-- ---------- Planes (las cuotas se cambian desde PATCH /planes/{id}) ----------
INSERT INTO fati.planes (id, nombre, precio_mensual, cuota_fati, resumen, beneficios, incluye_profesionista, orden) VALUES
('basico',  'Básico',   NULL,   30,  'Registro, cálculos, rutinas y análisis de comida. 30 preguntas a Fati al mes.', '{}', false, 1),
('fatiMax', 'Fati Max', 99.00,  500, 'Todo lo de Básico con 500 preguntas a Fati al mes.', '{}', false, 2),
('pro',     'Pro',      399.00, 500, 'Todo lo de Fati Max más seguimiento profesional.',
  ARRAY['Todo lo de Fati Max',
        'Un profesionista de la salud verificado revisa tus avances',
        'Recomendaciones firmadas y ajuste de tu plan',
        'Mensajes directos con tu profesionista',
        'Tú decides qué datos compartir'], true, 3);

INSERT INTO fati.configuracion (clave, valor, descripcion) VALUES
('fati.mensajes_contexto',        '10',        'Cuántos mensajes anteriores de la conversación se envían al modelo'),
('aviso.version',                 '"2026-11"', 'Versión vigente del aviso de privacidad'),
('alerta_mes.dias_activos_minimos', '15',      'Umbral de uso frecuente para la alerta del primer mes (fase 4)');

-- ---------- Catálogo de ejercicios ----------
INSERT INTO entrenamiento.ejercicios (nombre, tipo, grupo_muscular, nivel, equipo, impacto, al_aire_libre, contraindicaciones, minutos, dosis, icono) VALUES
-- Calentamiento
('Calentamiento: marcha en el lugar',      'calentamiento', 'cuerpo_completo', 1, 'ninguno',  'bajo', true,  '{}', 5, '5 min', 'caminar'),
('Calentamiento: movilidad articular',     'calentamiento', 'cuerpo_completo', 1, 'ninguno',  'bajo', true,  '{}', 5, '5 min', 'estirar'),
('Calentamiento: saltos de tijera',        'calentamiento', 'cuerpo_completo', 2, 'ninguno',  'alto', true,  '{rodilla,lumbar,cardiopatia,embarazo,hipertension}', 5, '5 min', 'entrenar'),
('Calentamiento: caminadora suave',        'calentamiento', 'cuerpo_completo', 1, 'gimnasio', 'bajo', false, '{}', 5, '5 min', 'caminar'),
-- Piernas y glúteos
('Sentadilla a silla',                     'fuerza', 'piernas', 1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 10', 'entrenar'),
('Sentadilla libre',                       'fuerza', 'piernas', 2, 'ninguno',  'bajo', true,  '{rodilla}', 5, '3 series × 12', 'entrenar'),
('Sentadilla con salto',                   'fuerza', 'piernas', 3, 'ninguno',  'alto', true,  '{rodilla,lumbar,cardiopatia,embarazo,hipertension}', 5, '3 series × 10', 'entrenar'),
('Desplantes alternados',                  'fuerza', 'piernas', 2, 'ninguno',  'bajo', true,  '{rodilla}', 5, '3 series × 10 por pierna', 'entrenar'),
('Elevación de talones',                   'fuerza', 'piernas', 1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 15', 'entrenar'),
('Sentadilla goblet con mancuerna',        'fuerza', 'piernas', 2, 'basico',   'bajo', false, '{rodilla}', 5, '3 series × 12', 'entrenar'),
('Prensa de piernas',                      'fuerza', 'piernas', 1, 'gimnasio', 'bajo', false, '{rodilla}', 5, '3 series × 12', 'entrenar'),
('Extensión de pierna en máquina (rango corto)', 'fuerza', 'piernas', 1, 'gimnasio', 'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Puente de glúteo',                       'fuerza', 'gluteos', 1, 'ninguno',  'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Patada de glúteo en cuatro puntos',      'fuerza', 'gluteos', 1, 'ninguno',  'bajo', false, '{}', 5, '3 series × 12 por pierna', 'entrenar'),
('Puente de glúteo con liga',              'fuerza', 'gluteos', 2, 'basico',   'bajo', false, '{}', 5, '3 series × 15', 'entrenar'),
('Peso muerto rumano con mancuernas',      'fuerza', 'gluteos', 2, 'basico',   'bajo', false, '{lumbar,embarazo}', 5, '3 series × 10', 'entrenar'),
('Hip thrust en banco',                    'fuerza', 'gluteos', 2, 'gimnasio', 'bajo', false, '{embarazo}', 5, '3 series × 12', 'entrenar'),
-- Pecho y hombros
('Flexiones en pared',                     'fuerza', 'pecho',   1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 8', 'entrenar'),
('Flexiones con rodillas apoyadas',        'fuerza', 'pecho',   2, 'ninguno',  'bajo', true,  '{embarazo}', 5, '3 series × 8', 'entrenar'),
('Flexiones completas',                    'fuerza', 'pecho',   3, 'ninguno',  'bajo', true,  '{embarazo,lumbar}', 5, '3 series × 10', 'entrenar'),
('Press de pecho con mancuernas',          'fuerza', 'pecho',   2, 'basico',   'bajo', false, '{}', 5, '3 series × 10', 'entrenar'),
('Press de pecho en máquina',              'fuerza', 'pecho',   1, 'gimnasio', 'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Elevaciones laterales con mancuernas',   'fuerza', 'hombros', 1, 'basico',   'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Press de hombro sentado',                'fuerza', 'hombros', 2, 'gimnasio', 'bajo', false, '{hipertension}', 5, '3 series × 10', 'entrenar'),
('Círculos de brazos',                     'fuerza', 'hombros', 1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 20 s', 'entrenar'),
-- Espalda
('Superman alternado',                     'fuerza', 'espalda', 1, 'ninguno',  'bajo', false, '{embarazo,lumbar}', 5, '3 series × 10', 'entrenar'),
('Ángeles de pared',                       'fuerza', 'espalda', 1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 10', 'entrenar'),
('Remo con liga',                          'fuerza', 'espalda', 1, 'basico',   'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Remo con mancuerna a una mano',          'fuerza', 'espalda', 2, 'basico',   'bajo', false, '{lumbar}', 5, '3 series × 10 por lado', 'entrenar'),
('Jalón al pecho en polea',                'fuerza', 'espalda', 1, 'gimnasio', 'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
('Remo sentado en máquina',                'fuerza', 'espalda', 1, 'gimnasio', 'bajo', false, '{}', 5, '3 series × 12', 'entrenar'),
-- Core
('Plancha con rodillas apoyadas',          'fuerza', 'core',    1, 'ninguno',  'bajo', false, '{embarazo}', 5, '3 series × 20 s', 'entrenar'),
('Plancha frontal',                        'fuerza', 'core',    2, 'ninguno',  'bajo', false, '{embarazo,hipertension}', 5, '3 series × 30 s', 'entrenar'),
('Bicho muerto (dead bug)',                'fuerza', 'core',    1, 'ninguno',  'bajo', false, '{embarazo}', 5, '3 series × 10', 'entrenar'),
('Pájaro-perro (bird dog)',                'fuerza', 'core',    1, 'ninguno',  'bajo', false, '{}', 5, '3 series × 10 por lado', 'entrenar'),
('Escaladores',                            'fuerza', 'core',    3, 'ninguno',  'alto', true,  '{rodilla,lumbar,cardiopatia,embarazo,hipertension}', 5, '3 series × 30 s', 'entrenar'),
('Inclinación pélvica de pie',             'fuerza', 'core',    1, 'ninguno',  'bajo', true,  '{}', 5, '3 series × 12', 'entrenar'),
-- Cardio
('Caminata a paso ligero',                 'cardio', 'cuerpo_completo', 1, 'ninguno',  'bajo', true,  '{}', 10, '10 min', 'caminar'),
('Caminata con intervalos rápidos',        'cardio', 'cuerpo_completo', 2, 'ninguno',  'bajo', true,  '{cardiopatia}', 10, '10 min', 'caminar'),
('Trote suave',                            'cardio', 'cuerpo_completo', 2, 'ninguno',  'alto', true,  '{rodilla,lumbar,cardiopatia,embarazo}', 10, '10 min', 'caminar'),
('Bicicleta fija',                         'cardio', 'cuerpo_completo', 1, 'gimnasio', 'bajo', false, '{}', 10, '10 min', 'caminar'),
('Elíptica',                               'cardio', 'cuerpo_completo', 1, 'gimnasio', 'bajo', false, '{}', 10, '10 min', 'caminar'),
('Subir escalones a paso suave',           'cardio', 'cuerpo_completo', 2, 'ninguno',  'bajo', true,  '{rodilla,cardiopatia}', 5, '5 min', 'caminar'),
-- Estiramiento
('Estiramientos',                          'estiramiento', 'cuerpo_completo', 1, 'ninguno', 'bajo', true, '{}', 5, '5 min', 'estirar'),
('Estiramientos de piernas y espalda',     'estiramiento', 'cuerpo_completo', 1, 'ninguno', 'bajo', true, '{}', 5, '5 min', 'estirar');

-- ---------- Catálogo de alimentos locales (valores por porción) ----------
INSERT INTO nutricion.alimentos (nombre, categoria, porcion, kcal, proteina_g, carbos_g, grasa_g) VALUES
('Tortilla de maíz',            'cereales',  '1 pieza',        64,  1.5, 13,   0.8),
('Tortilla de harina',          'cereales',  '1 pieza',        140, 3.5, 23,   3.5),
('Tostada horneada',            'cereales',  '1 pieza',        45,  1,   9,    0.5),
('Arroz rojo',                  'cereales',  '1 taza',         210, 4,   42,   3),
('Arroz blanco al vapor',       'cereales',  '1 taza',         200, 4,   44,   0.5),
('Pan dulce (concha)',          'cereales',  '1 pieza',        290, 6,   45,   10),
('Pan integral',                'cereales',  '1 rebanada',     70,  3.5, 12,   1),
('Bolillo',                     'cereales',  '1 pieza',        190, 6,   38,   1.5),
('Avena cocida con agua',       'cereales',  '1 taza',         150, 5,   27,   3),
('Frijoles de la olla',         'leguminosas', '½ taza',       120, 8,   20,   0.5),
('Frijoles refritos',           'leguminosas', '½ taza',       190, 8,   22,   8),
('Lentejas guisadas',           'leguminosas', '1 taza',       230, 16,  38,   2),
('Huevo revuelto',              'proteinas', '2 piezas',       180, 12,  2,    14),
('Huevo cocido',                'proteinas', '1 pieza',        75,  6,   0.5,  5),
('Pechuga a la plancha',        'proteinas', '150 g',          248, 46,  0,    6),
('Pollo empanizado frito',      'proteinas', '150 g',          420, 30,  22,   23),
('Carne asada',                 'proteinas', '120 g',          280, 30,  0,    17),
('Carnitas',                    'proteinas', '120 g',          390, 26,  0,    31),
('Atún en agua',                'proteinas', '1 lata',         110, 25,  0,    1),
('Pescado a la plancha',        'proteinas', '150 g',          190, 34,  0,    5),
('Queso panela',                'lacteos',   '40 g',           80,  7,   1,    5.5),
('Queso Oaxaca',                'lacteos',   '40 g',           125, 9,   1,    9.5),
('Leche entera',                'lacteos',   '1 vaso',         150, 8,   12,   8),
('Leche descremada',            'lacteos',   '1 vaso',         85,  8,   12,   0.5),
('Yogur natural sin azúcar',    'lacteos',   '1 taza',         110, 9,   12,   3),
('Yogur de sabor azucarado',    'lacteos',   '1 taza',         210, 7,   36,   3.5),
('Café con leche',              'bebidas',   '1 taza',         112, 6,   10,   5),
('Café con azúcar',             'bebidas',   '1 taza',         50,  0,   12,   0),
('Café sin azúcar',             'bebidas',   '1 taza',         2,   0,   0,    0),
('Refresco de cola 600 ml',     'bebidas',   '1 botella',      252, 0,   63,   0),
('Agua mineral con limón',      'bebidas',   '1 vaso',         0,   0,   0,    0),
('Agua de jamaica',             'bebidas',   '1 vaso',         62,  0,   16,   0),
('Agua de jamaica sin azúcar',  'bebidas',   '1 vaso',         5,   0,   1,    0),
('Jugo de naranja envasado',    'bebidas',   '1 vaso',         120, 1,   29,   0),
('Agua simple',                 'bebidas',   '1 vaso',         0,   0,   0,    0),
('Manzana',                     'frutas',    '1 pieza',        80,  0.5, 21,   0.3),
('Plátano',                     'frutas',    '1 pieza',        105, 1.3, 27,   0.4),
('Naranja',                     'frutas',    '1 pieza',        62,  1.2, 15,   0.2),
('Papaya picada',               'frutas',    '1 taza',         62,  0.7, 16,   0.4),
('Manzana y cacahuates',        'colaciones', '1 pieza · 30 g', 180, 6,  20,   9.5),
('Cacahuates naturales',        'colaciones', '30 g',          170, 7,   5,    14),
('Papas fritas de bolsa',       'colaciones', '1 bolsa (45 g)', 240, 3,  23,   15),
('Palomitas naturales',         'colaciones', '3 tazas',       95,  3,   19,   1),
('Jícama con limón y chile',    'colaciones', '1 taza',        50,  1,   12,   0.1),
('Galletas rellenas',           'colaciones', '4 piezas',      200, 2,   29,   9),
('Ensalada verde',              'verduras',  '1 plato',        35,  2,   7,    0.3),
('Nopales asados',              'verduras',  '1 taza',         25,  2,   5,    0.2),
('Verduras al vapor',           'verduras',  '1 taza',         55,  3,   11,   0.5),
('Aguacate',                    'verduras',  '¼ pieza',        80,  1,   4,    7.5),
('Tacos al pastor',             'antojitos', '3 piezas',       450, 22,  42,   21),
('Tacos de pollo a la plancha', 'antojitos', '3 piezas',       330, 30,  39,   6),
('Quesadilla frita',            'antojitos', '1 pieza',        310, 10,  26,   18),
('Quesadilla al comal',         'antojitos', '1 pieza',        190, 10,  14,   10),
('Torta de milanesa',           'antojitos', '1 pieza',        650, 30,  62,   30),
('Hamburguesa con papas',       'antojitos', '1 combo',        950, 32,  98,   46),
('Pizza de pepperoni',          'antojitos', '2 rebanadas',    570, 24,  62,   25),
('Tamal de pollo',              'antojitos', '1 pieza',        290, 10,  30,   14);

-- Sustitutos más ligeros para el análisis de alimentación.
UPDATE nutricion.alimentos a SET sustituto_id = s.id
FROM (VALUES
  ('Refresco de cola 600 ml',   'Agua mineral con limón'),
  ('Jugo de naranja envasado',  'Naranja'),
  ('Agua de jamaica',           'Agua de jamaica sin azúcar'),
  ('Café con azúcar',           'Café sin azúcar'),
  ('Pan dulce (concha)',        'Pan integral'),
  ('Tortilla de harina',        'Tortilla de maíz'),
  ('Frijoles refritos',         'Frijoles de la olla'),
  ('Pollo empanizado frito',    'Pechuga a la plancha'),
  ('Carnitas',                  'Carne asada'),
  ('Queso Oaxaca',              'Queso panela'),
  ('Leche entera',              'Leche descremada'),
  ('Yogur de sabor azucarado',  'Yogur natural sin azúcar'),
  ('Papas fritas de bolsa',     'Palomitas naturales'),
  ('Galletas rellenas',         'Manzana'),
  ('Tacos al pastor',           'Tacos de pollo a la plancha'),
  ('Quesadilla frita',          'Quesadilla al comal'),
  ('Arroz rojo',                'Verduras al vapor'),
  ('Hamburguesa con papas',     'Tacos de pollo a la plancha'),
  ('Torta de milanesa',         'Tacos de pollo a la plancha')
) AS par (alimento, sustituto)
JOIN nutricion.alimentos s ON s.nombre = par.sustituto
WHERE a.nombre = par.alimento;
