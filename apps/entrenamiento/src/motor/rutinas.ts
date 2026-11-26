/**
 * Motor de rutinas: filtra el catálogo según el perfil y arma la semana.
 * Funciones puras, sin IA ni base de datos (pruebas en rutinas.spec.ts).
 */

export type Lugar = 'casa' | 'casaEquipo' | 'gimnasio' | 'parque';
export type Equipo = 'ninguno' | 'basico' | 'gimnasio';
export type TipoEjercicio = 'calentamiento' | 'fuerza' | 'cardio' | 'estiramiento';
export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muyActivo';

export type EjercicioCatalogo = {
  id: string;
  nombre: string;
  tipo: TipoEjercicio;
  grupoMuscular: string;
  nivel: number;
  equipo: Equipo;
  impacto: 'bajo' | 'alto';
  alAireLibre: boolean;
  contraindicaciones: string[];
  minutos: number;
  dosis: string;
  icono: string;
};

/** Lo que el motor necesita del perfil. Se guarda con la rutina para saber cuándo regenerarla. */
export type Parametros = {
  minutos: number;
  lugar: Lugar;
  nivelActividad: NivelActividad;
  condiciones: string[];
  bajoImpacto: boolean;
};

export type EjercicioRutina = { ejercicioId: string; nombre: string; dosis: string; icono: string };
export type RutinaGenerada = {
  nombre: string;
  minutos: number;
  equipo: string;
  nota: string;
  sesionesSemana: number;
  dias: { diaSemana: number; ejercicios: EjercicioRutina[] }[];
};

const POR_LUGAR: Record<Lugar, { nombre: string; equipo: string; permitido: Equipo[] }> = {
  casa: { nombre: 'Fuerza en casa', equipo: 'sin equipo', permitido: ['ninguno'] },
  casaEquipo: { nombre: 'Fuerza en casa', equipo: 'equipo básico', permitido: ['ninguno', 'basico'] },
  gimnasio: { nombre: 'Fuerza en gimnasio', equipo: 'máquinas y pesas', permitido: ['ninguno', 'basico', 'gimnasio'] },
  parque: { nombre: 'Cardio y fuerza al aire libre', equipo: 'sin equipo', permitido: ['ninguno'] },
};

/** Nivel máximo de ejercicio y días de entrenamiento (1 = lunes) según la actividad declarada. */
const POR_ACTIVIDAD: Record<NivelActividad, { nivel: number; dias: number[] }> = {
  sedentario: { nivel: 1, dias: [1, 3, 5] },
  ligero: { nivel: 1, dias: [1, 3, 5] },
  moderado: { nivel: 2, dias: [1, 2, 4, 5] },
  activo: { nivel: 3, dias: [1, 2, 3, 5, 6] },
  muyActivo: { nivel: 3, dias: [1, 2, 3, 5, 6] },
};

const GRUPOS = ['piernas', 'pecho', 'gluteos', 'espalda', 'core', 'hombros'];
const RANGO_EQUIPO: Record<Equipo, number> = { ninguno: 0, basico: 1, gimnasio: 2 };

/** Ejercicios que el usuario sí puede hacer: por equipo, nivel, contraindicaciones e impacto. */
export function filtrarCatalogo(catalogo: EjercicioCatalogo[], p: Parametros) {
  const { permitido } = POR_LUGAR[p.lugar];
  const nivelMax = POR_ACTIVIDAD[p.nivelActividad].nivel;
  return catalogo.filter(
    (e) =>
      permitido.includes(e.equipo) &&
      e.nivel <= nivelMax &&
      (p.lugar !== 'parque' || e.alAireLibre) &&
      !(p.bajoImpacto && e.impacto === 'alto') &&
      !e.contraindicaciones.some((c) => p.condiciones.includes(c)),
  );
}

export function armarRutina(catalogo: EjercicioCatalogo[], p: Parametros): RutinaGenerada {
  const disponibles = filtrarCatalogo(catalogo, p);
  // Primero lo que aprovecha el equipo disponible y el nivel del usuario; el nombre da un orden estable.
  const deTipo = (tipo: TipoEjercicio, grupo?: string) =>
    disponibles
      .filter((e) => e.tipo === tipo && (!grupo || e.grupoMuscular === grupo))
      .sort((a, b) => RANGO_EQUIPO[b.equipo] - RANGO_EQUIPO[a.equipo] || b.nivel - a.nivel || a.nombre.localeCompare(b.nombre));

  const calentamientos = deTipo('calentamiento');
  const estiramientos = deTipo('estiramiento');
  const cardios = deTipo('cardio');
  const corta = p.minutos <= 15;
  // 5 min de calentamiento y 5 de estiramiento; el resto, bloques de ~5 min.
  const bloques = Math.min(8, Math.max(2, Math.floor((p.minutos - 10) / 5)));
  const conCardio = cardios.length > 0 && (p.lugar === 'parque' || p.minutos >= 45);

  const { dias } = POR_ACTIVIDAD[p.nivelActividad];
  const semana = dias.map((diaSemana, i) => {
    const elegidos: EjercicioCatalogo[] = [];
    let libres = bloques;
    if (conCardio) {
      const c = cardios[i % cardios.length];
      elegidos.push(c);
      libres -= Math.max(1, Math.round(c.minutos / 5));
    }
    // Se recorren los grupos musculares empezando en uno distinto cada día para variar.
    for (let vueltas = 0; libres > 0 && vueltas < GRUPOS.length * 3; vueltas++) {
      const candidatos = deTipo('fuerza', GRUPOS[(i + vueltas) % GRUPOS.length]).filter((e) => !elegidos.includes(e));
      if (!candidatos.length) continue;
      // Entre las dos mejores opciones del grupo se alterna según el día.
      elegidos.push(candidatos[i % Math.min(2, candidatos.length)]);
      libres--;
    }
    if (!elegidos.length) throw new Error('El catálogo no tiene ejercicios compatibles con este perfil.');

    const aItem = (e: EjercicioCatalogo, dosis = e.dosis): EjercicioRutina => ({ ejercicioId: e.id, nombre: e.nombre, dosis, icono: e.icono });
    return {
      diaSemana,
      ejercicios: [
        ...(calentamientos.length ? [aItem(calentamientos[i % calentamientos.length], corta ? '3 min' : undefined)] : []),
        ...elegidos.map((e) => aItem(e)),
        ...(estiramientos.length ? [aItem(estiramientos[i % estiramientos.length], corta ? '2 min' : undefined)] : []),
      ],
    };
  });

  const nota = p.condiciones.includes('rodilla')
    ? 'Rutina sin saltos para cuidar tus rodillas, según tu perfil.'
    : p.bajoImpacto
      ? 'Rutina de bajo impacto adaptada a tu perfil.'
      : 'Rutina para empezar poco a poco; subirá de nivel según tu avance.';

  return {
    nombre: `${POR_LUGAR[p.lugar].nombre}${p.bajoImpacto ? ' · bajo impacto' : ''}`,
    minutos: p.minutos,
    equipo: POR_LUGAR[p.lugar].equipo,
    nota,
    sesionesSemana: dias.length,
    dias: semana,
  };
}
