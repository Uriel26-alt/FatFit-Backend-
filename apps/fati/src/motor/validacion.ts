import { Contexto } from './contexto';

/**
 * Validación de la respuesta del modelo antes de mostrarla. Si algo falla,
 * el servidor descarta el texto y responde con las plantillas de reglas.
 */
export type Validacion = { valida: true } | { valida: false; motivo: string };

export const LARGO_MAXIMO = 2500;

/** Lenguaje de culpa o castigo sobre el cuerpo o la comida. */
const CULPA = /\b(culpa(ble)?s?|castig\w*|vergüenza|vergonzos\w*|pecad\w*|pecar|gord[oa]s?|floj[oa]s?|fracas\w*|te portaste mal|comida chatarra|prohibid[oa]s?|hiciste trampa|día trampa)\b/i;

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Todas las cifras de calorías que el servidor calculó y que Fati puede citar. */
export function cifrasPermitidas(ctx: Contexto): Set<number> {
  const n = new Set<number>([0]);
  const c = ctx.calculo;
  if (c) [c.gastoBasal, c.gastoDiario, c.meta, c.minimoSeguro, c.deficit].forEach((v) => n.add(v));
  const h = ctx.comidasDeHoy;
  if (h) {
    n.add(h.consumido);
    if (h.restantes !== null) n.add(Math.abs(h.restantes));
    h.alimentos.forEach((a) => n.add(Math.round(a.kcal)));
  }
  const a = ctx.analisisDeAyer;
  if (a) {
    [a.consumido, a.exceso, a.mayorAporte?.kcal, a.sustituto?.kcal, a.sustituto?.ahorro].forEach((v) => v !== undefined && n.add(v));
  }
  return n;
}

/** «1,650 kcal», «1 650 kcal», «1650 calorías» → 1650 */
function caloriasCitadas(texto: string): number[] {
  const re = /(\d{1,3}(?:[.,\s ]\d{3})+|\d+)\s*(?:kcal|kilocalor[ií]as|calor[ií]as)/gi;
  return [...texto.matchAll(re)].map((m) => Number(m[1].replace(/[.,\s ]/g, '')));
}

/** Ejercicios del catálogo que aparecen en el texto pero no están en la rutina del usuario. */
export function ejerciciosFueraDeLista(texto: string, ctx: Contexto): string[] {
  const permitidos = (ctx.rutina?.ejerciciosPermitidos ?? []).map(normalizar);
  // Primero se retiran los permitidos (del más largo al más corto) para que
  // «Estiramientos de piernas y espalda» no cuente como «Estiramientos».
  let resto = normalizar(texto);
  for (const p of [...permitidos].sort((a, b) => b.length - a.length)) resto = resto.split(p).join(' ');
  return ctx.catalogoEjercicios.filter((e) => !permitidos.includes(normalizar(e)) && resto.includes(normalizar(e)));
}

export function validarRespuesta(texto: string, ctx: Contexto): Validacion {
  const t = texto.trim();
  if (!t) return { valida: false, motivo: 'respuesta vacía' };
  if (t.length > LARGO_MAXIMO) return { valida: false, motivo: 'respuesta demasiado larga' };

  const culpa = t.match(CULPA);
  if (culpa) return { valida: false, motivo: `lenguaje de culpa: «${culpa[0]}»` };

  // Fati no calcula: cualquier cifra de calorías debe venir de los resultados del servidor.
  const permitidas = cifrasPermitidas(ctx);
  const inventada = caloriasCitadas(t).find((n) => !permitidas.has(n));
  if (inventada !== undefined) {
    const minimo = ctx.calculo?.minimoSeguro;
    return { valida: false, motivo: minimo && inventada < minimo ? `cifra por debajo del mínimo seguro: ${inventada} kcal` : `cifra de calorías no calculada: ${inventada} kcal` };
  }

  const fuera = ejerciciosFueraDeLista(t, ctx);
  if (fuera.length) return { valida: false, motivo: `ejercicio fuera de la lista permitida: ${fuera[0]}` };

  return { valida: true };
}
