/**
 * Análisis de alimentación: compara lo consumido contra la meta diaria, detecta
 * el exceso, qué alimentos aportan más y propone un sustituto más ligero.
 * Funciones puras, sin IA (pruebas en analisis.spec.ts).
 */

export type Macros = { kcal: number; p: number; c: number; g: number };
export type Consumo = Macros & {
  nombre: string;
  /** Opción más ligera del catálogo para la misma cantidad, si existe. */
  sustituto?: { nombre: string; kcal: number } | null;
};
export type Meta = { kcal: number; minimoSeguro: number; macros: { proteina: number; carbos: number; grasa: number } };
export type EstadoDia = 'sin_registros' | 'en_curso' | 'dentro_de_meta' | 'exceso' | 'por_debajo_del_minimo';

/** Margen sobre la meta que todavía se considera "dentro": nadie come exactamente su meta. */
export const TOLERANCIA = 0.05;

const r1 = (n: number) => Math.round(n * 10) / 10;

export function sumar(items: Macros[]): Macros {
  const t = items.reduce((s, a) => ({ kcal: s.kcal + a.kcal, p: s.p + a.p, c: s.c + a.c, g: s.g + a.g }), { kcal: 0, p: 0, c: 0, g: 0 });
  return { kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), g: r1(t.g) };
}

/** @param diaEnCurso true si el día aún no termina: comer poco todavía no significa nada. */
export function analizarDia(consumos: Consumo[], meta: Meta, diaEnCurso = false) {
  const totales = sumar(consumos);
  const diferencia = totales.kcal - meta.kcal;

  let estado: EstadoDia = 'dentro_de_meta';
  if (!consumos.length) estado = 'sin_registros';
  else if (totales.kcal > meta.kcal * (1 + TOLERANCIA)) estado = 'exceso';
  else if (diaEnCurso && totales.kcal <= meta.kcal) estado = 'en_curso';
  else if (totales.kcal < meta.minimoSeguro) estado = 'por_debajo_del_minimo';

  // Un mismo alimento registrado varias veces cuenta junto.
  const porAlimento = new Map<string, { nombre: string; kcal: number; sustituto: Consumo['sustituto'] }>();
  for (const c of consumos) {
    const a = porAlimento.get(c.nombre) ?? { nombre: c.nombre, kcal: 0, sustituto: null };
    a.kcal += c.kcal;
    if (c.sustituto) a.sustituto = { nombre: c.sustituto.nombre, kcal: (a.sustituto?.kcal ?? 0) + c.sustituto.kcal };
    porAlimento.set(c.nombre, a);
  }
  const ordenados = [...porAlimento.values()].sort((a, b) => b.kcal - a.kcal);
  const principales = ordenados.slice(0, 3).map(({ nombre, kcal }) => ({ nombre, kcal: Math.round(kcal) }));

  // El sustituto solo se propone cuando hubo exceso: el que más calorías ahorra.
  let mayorAporte: { nombre: string; kcal: number } | null = principales[0] ?? null;
  let sustituto: { nombre: string; kcal: number; ahorro: number } | null = null;
  if (estado === 'exceso') {
    const mejor = ordenados
      .filter((a) => a.sustituto && a.sustituto.kcal < a.kcal)
      .sort((a, b) => b.kcal - b.sustituto!.kcal - (a.kcal - a.sustituto!.kcal))[0];
    if (mejor) {
      mayorAporte = { nombre: mejor.nombre, kcal: Math.round(mejor.kcal) };
      sustituto = { nombre: mejor.sustituto!.nombre, kcal: Math.round(mejor.sustituto!.kcal), ahorro: Math.round(mejor.kcal - mejor.sustituto!.kcal) };
    }
  }

  return {
    estado,
    consumido: totales.kcal,
    meta: meta.kcal,
    diferencia,
    exceso: estado === 'exceso' ? diferencia : 0,
    totales,
    metaMacros: meta.macros,
    principales,
    mayorAporte,
    sustituto,
    mensaje: redactar(estado, diferencia, mayorAporte, sustituto),
  };
}

/** Mensajes en tono neutro: describen y proponen, sin culpa ni castigo. */
function redactar(estado: EstadoDia, diferencia: number, mayor: { nombre: string; kcal: number } | null, sustituto: { nombre: string; ahorro: number } | null) {
  switch (estado) {
    case 'sin_registros':
      return 'Aún no hay comidas registradas este día. Registra lo que comas para ver tu análisis.';
    case 'en_curso':
      return `Llevas registrado el día; te quedan ${-diferencia} kcal para llegar a tu meta.`;
    case 'por_debajo_del_minimo':
      return 'Lo registrado queda por debajo del mínimo recomendado. Comer suficiente también es parte del plan: procura completar tus comidas.';
    case 'dentro_de_meta':
      return diferencia <= 0 ? 'Quedaste dentro de tu meta del día. ¡Buen ritmo!' : 'Quedaste prácticamente en tu meta del día. ¡Buen ritmo!';
    case 'exceso':
      if (mayor && sustituto) {
        return `Pasaste tu meta por ${diferencia} kcal. Lo que más aportó fue ${mayor.nombre} (${mayor.kcal} kcal); si lo cambias por ${sustituto.nombre} ahorras ${sustituto.ahorro} kcal.`;
      }
      return mayor
        ? `Pasaste tu meta por ${diferencia} kcal. Lo que más aportó fue ${mayor.nombre} (${mayor.kcal} kcal); una porción más pequeña puede ayudarte.`
        : `Pasaste tu meta por ${diferencia} kcal.`;
  }
}
