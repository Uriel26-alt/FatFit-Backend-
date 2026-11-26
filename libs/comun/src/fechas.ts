/** Fechas como 'AAAA-MM-DD' en la zona horaria del servidor (variable TZ). */

const p2 = (n: number) => String(n).padStart(2, '0');
export const aFecha = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const deFecha = (f: string) => {
  const [a, m, d] = f.split('-').map(Number);
  return new Date(a, m - 1, d);
};

export const hoy = () => aFecha(new Date());
export function sumarDias(fecha: string, dias: number) {
  const d = deFecha(fecha);
  d.setDate(d.getDate() + dias);
  return aFecha(d);
}
/** 1 = lunes … 7 = domingo. */
export const diaSemana = (fecha: string) => deFecha(fecha).getDay() || 7;
/** Lunes de la semana a la que pertenece la fecha. */
export const lunesDe = (fecha: string) => sumarDias(fecha, 1 - diaSemana(fecha));
/** Periodo mensual 'AAAA-MM' y el día en que empieza el siguiente. */
export const periodoDe = (fecha: string) => fecha.slice(0, 7);
export function inicioSiguientePeriodo(fecha: string) {
  const d = deFecha(fecha);
  return aFecha(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}
export const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
