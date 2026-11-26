/**
 * Motor de reglas de FatFit: cálculo base, sin IA y sin acceso a la base de datos.
 * Son funciones puras para poder probarlas (calculos.spec.ts). Este es el cálculo
 * oficial; el del front (src/logic/calculos.ts) solo existe para sus datos de ejemplo.
 */

export type Sexo = 'mujer' | 'hombre';
export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muyActivo';
export type Objetivo = 'bajar' | 'mantener' | 'ganar';
export type Condicion = 'rodilla' | 'lumbar' | 'hipertension' | 'diabetes' | 'cardiopatia' | 'embarazo';

export const SEXOS: Sexo[] = ['mujer', 'hombre'];
export const NIVELES: NivelActividad[] = ['sedentario', 'ligero', 'moderado', 'activo', 'muyActivo'];
export const OBJETIVOS: Objetivo[] = ['bajar', 'mantener', 'ganar'];
export const CONDICIONES: Condicion[] = ['rodilla', 'lumbar', 'hipertension', 'diabetes', 'cardiopatia', 'embarazo'];

export type PerfilFisico = {
  edad: number;
  sexo: Sexo;
  alturaCm: number;
  pesoKg: number;
  nivelActividad: NivelActividad;
  objetivo: Objetivo;
  condiciones: Condicion[];
};

/** Multiplicador del gasto basal según el nivel de actividad. */
export const FACTOR_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  activo: 1.725,
  muyActivo: 1.9,
};

/** Mínimo calórico seguro: nunca se recomienda menos que esto. */
export const MINIMO_SEGURO: Record<Sexo, number> = { mujer: 1200, hombre: 1500 };

const DEFICIT = 0.2; // 20 % del gasto diario…
const DEFICIT_MAX_KCAL = 750; // …sin pasar de 750 kcal
const SUPERAVIT = 0.1;
/** IMC a partir del cual (o por debajo del cual) se pide valoración médica. */
const IMC_EXTREMO = { bajo: 16, alto: 40 };

const redondear10 = (n: number) => Math.round(n / 10) * 10;
const redondear1 = (n: number) => Math.round(n * 10) / 10;

export function imc(pesoKg: number, alturaCm: number) {
  const m = alturaCm / 100;
  return redondear1(pesoKg / (m * m));
}

export function clasificarImc(valor: number) {
  if (valor < 18.5) return 'Bajo peso';
  if (valor < 25) return 'Normal';
  if (valor < 30) return 'Sobrepeso';
  if (valor < 35) return 'Obesidad I';
  if (valor < 40) return 'Obesidad II';
  return 'Obesidad III';
}

/** Gasto calórico basal con la fórmula de Mifflin-St Jeor. */
export function gastoBasal({ pesoKg, alturaCm, edad, sexo }: Pick<PerfilFisico, 'pesoKg' | 'alturaCm' | 'edad' | 'sexo'>) {
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * edad;
  return sexo === 'hombre' ? base + 5 : base - 161;
}

/** Gasto diario total: basal × factor de actividad. */
export function gastoDiario(p: PerfilFisico) {
  return gastoBasal(p) * FACTOR_ACTIVIDAD[p.nivelActividad];
}

/**
 * Meta diaria de calorías según el objetivo.
 * - Bajar: déficit del 20 % (máx. 750 kcal). Sin déficit en embarazo o con bajo peso.
 * - Ganar: superávit del 10 %.
 * - Nunca por debajo del mínimo seguro.
 */
export function metaCalorica(p: PerfilFisico) {
  const gasto = gastoDiario(p);
  const sinDeficit = p.condiciones.includes('embarazo') || imc(p.pesoKg, p.alturaCm) < 18.5;
  let meta = gasto;
  if (p.objetivo === 'bajar' && !sinDeficit) meta = gasto - Math.min(gasto * DEFICIT, DEFICIT_MAX_KCAL);
  if (p.objetivo === 'ganar') meta = gasto * (1 + SUPERAVIT);
  return Math.max(redondear10(meta), MINIMO_SEGURO[p.sexo]);
}

/** Proteína por kg de peso (más alta en déficit), 30 % de grasa y el resto carbohidratos. */
export function metaMacros(meta: number, p: Pick<PerfilFisico, 'pesoKg' | 'objetivo'>) {
  const proteina = Math.round(p.pesoKg * (p.objetivo === 'bajar' ? 1.2 : 1));
  const grasa = Math.round((meta * 0.3) / 9);
  const carbos = Math.max(0, Math.round((meta - proteina * 4 - grasa * 9) / 4));
  return { proteina, carbos, grasa };
}

/** Ritmo seguro de pérdida: entre 0.5 % y 1 % del peso por semana. */
export function ritmoSeguro(pesoKg: number) {
  return { min: redondear1(pesoKg * 0.005), max: redondear1(pesoKg * 0.01) };
}

/** Embarazo, cardiopatía, diabetes o IMC extremo: consulta médica desde el primer día. */
export function requiereConsultaMedica(p: PerfilFisico) {
  const valor = imc(p.pesoKg, p.alturaCm);
  return p.condiciones.some((c) => c === 'embarazo' || c === 'cardiopatia' || c === 'diabetes') || valor < IMC_EXTREMO.bajo || valor >= IMC_EXTREMO.alto;
}

/** Rutina de bajo impacto si hay alguna condición declarada o el IMC es de 35 o más. */
export function requiereBajoImpacto(p: Pick<PerfilFisico, 'pesoKg' | 'alturaCm' | 'condiciones'>) {
  return p.condiciones.length > 0 || imc(p.pesoKg, p.alturaCm) >= 35;
}

export function resumen(p: PerfilFisico) {
  const meta = metaCalorica(p);
  const gasto = redondear10(gastoDiario(p));
  const valorImc = imc(p.pesoKg, p.alturaCm);
  return {
    imc: valorImc,
    clasificacion: clasificarImc(valorImc),
    gastoBasal: redondear10(gastoBasal(p)),
    gastoDiario: gasto,
    meta,
    minimoSeguro: MINIMO_SEGURO[p.sexo],
    deficit: Math.max(0, gasto - meta),
    macros: metaMacros(meta, p),
    ritmo: ritmoSeguro(p.pesoKg),
    consultaMedica: requiereConsultaMedica(p),
    bajoImpacto: requiereBajoImpacto(p),
  };
}
