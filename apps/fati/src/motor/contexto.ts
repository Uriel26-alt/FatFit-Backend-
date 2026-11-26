/**
 * Lo único que Fati conoce del usuario: resultados ya calculados por los motores
 * de reglas y la lista de ejercicios permitidos. Fati redacta; no calcula.
 */
export type Contexto = {
  nombre: string;
  objetivo: 'bajar' | 'mantener' | 'ganar' | null;
  pesoActualKg: number | null;
  calculo: {
    imc: number;
    clasificacion: string;
    gastoBasal: number;
    gastoDiario: number;
    meta: number;
    minimoSeguro: number;
    deficit: number;
    macros: { proteina: number; carbos: number; grasa: number };
    ritmo: { min: number; max: number };
    consultaMedica: boolean;
  } | null;
  rutina: {
    nombre: string;
    nota: string;
    hoyEsDiaDeEntreno: boolean;
    ejerciciosDeHoy: { nombre: string; dosis: string }[];
    /** Todos los ejercicios de su rutina semanal: los únicos que Fati puede sugerir. */
    ejerciciosPermitidos: string[];
  } | null;
  comidasDeHoy: { consumido: number; restantes: number | null; alimentos: { nombre: string; kcal: number }[] } | null;
  analisisDeAyer: {
    estado: string;
    consumido: number;
    exceso: number;
    mayorAporte: { nombre: string; kcal: number } | null;
    sustituto: { nombre: string; kcal: number; ahorro: number } | null;
  } | null;
  /** Indicaciones de su profesionista: tienen prioridad sobre todo lo demás. */
  recomendacionesProfesionista: string[];
  /** Nombres de todo el catálogo; sirve para detectar ejercicios fuera de la lista permitida. */
  catalogoEjercicios: string[];
};

export const AVISO_MEDICO = 'Fati no sustituye a un médico. Solo un profesionista de la salud puede darte recomendaciones médicas.';
