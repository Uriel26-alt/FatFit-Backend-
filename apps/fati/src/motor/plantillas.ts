import { Contexto } from './contexto';

/**
 * Respuestas de Fati sin LLM: plantillas que solo acomodan los resultados ya
 * calculados. Se usan cuando no hay llave del modelo, cuando el modelo falla
 * o cuando su respuesta no pasa la validación.
 */

const n = (v: number) => v.toLocaleString('es-MX');
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? '';

export function saludo(nombre: string) {
  const p = primerNombre(nombre);
  return `¡Hola${p ? `, ${p}` : ''}! Soy Fati. Puedo explicarte tu meta, tus comidas o tu rutina con palabras simples. ¿Por dónde empezamos?`;
}

export function cuotaAgotada(renuevaEl: string, planActual: string) {
  const fecha = new Date(`${renuevaEl}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  const subir = planActual === 'basico' ? ', o puedes subir a Fati Max o Pro para seguir platicando' : '';
  return `Ya usaste tus preguntas de este mes. Se renuevan el ${fecha}${subir}. Mientras tanto, tu meta, tu rutina y tu análisis de comida siguen disponibles en la app.`;
}

type Respuesta = { texto: string; basadoEnCalculos: boolean };

export function respuestaDeReglas(pregunta: string, ctx: Contexto): Respuesta {
  const q = pregunta.toLowerCase();
  const c = ctx.calculo;
  const partes: string[] = [];
  let basado = false;

  if (!c) {
    return { texto: 'Para darte respuestas a tu medida necesito que completes tu perfil inicial. En cuanto lo termines te explico tu meta, tus comidas y tu rutina.', basadoEnCalculos: false };
  }

  // Lo que diga su profesionista va primero.
  if (ctx.recomendacionesProfesionista.length) partes.push(`Tu profesionista te indicó: «${ctx.recomendacionesProfesionista[0]}». Eso tiene prioridad sobre lo que yo te diga.`);

  if (/ejercic|rutina|entren|cambiar|sentadilla|plancha|flexi|duele|dolor/.test(q) && ctx.rutina) {
    const r = ctx.rutina;
    const hoy = r.ejerciciosDeHoy.map((e) => `${e.nombre} (${e.dosis})`);
    const otros = r.ejerciciosPermitidos.filter((e) => !r.ejerciciosDeHoy.some((h) => h.nombre === e) && !/calentamiento|estiramiento/i.test(e)).slice(0, 3);
    partes.push(hoy.length ? `Tu rutina de hoy es «${r.nombre}»: ${hoy.join(', ')}.` : `Hoy te toca descanso en tu rutina «${r.nombre}»; descansar también cuenta.`);
    if (otros.length) partes.push(`Si quieres cambiar alguno, de tu propia rutina puedes usar: ${otros.join(', ')}. ${r.nota}`);
    partes.push('Si algo te duele, detente y coméntalo con un profesional de la salud.');
  } else if (/cena|comer|comid|desayun|hambre|antojo|refresco|colaci/.test(q)) {
    basado = true;
    const h = ctx.comidasDeHoy;
    if (h && h.restantes !== null) {
      partes.push(h.restantes >= 0 ? `Hoy llevas ${n(h.consumido)} kcal y te quedan ${n(h.restantes)} kcal para tu meta de ${n(c.meta)} kcal.` : `Hoy llevas ${n(h.consumido)} kcal; tu meta es de ${n(c.meta)} kcal. Mañana es un día nuevo para acomodarlo.`);
    } else partes.push(`Tu meta del día es de ${n(c.meta)} kcal.`);
    partes.push(`Procura incluir proteína (tu meta es ${c.macros.proteina} g al día) y verduras; ayudan a quedar satisfecho.`);
    const a = ctx.analisisDeAyer;
    if (a?.sustituto && a.mayorAporte) partes.push(`Una idea de ayer: cambiar ${a.mayorAporte.nombre} por ${a.sustituto.nombre} te ahorra ${n(a.sustituto.ahorro)} kcal.`);
  } else {
    basado = true;
    partes.push(`Tu cuerpo gasta cerca de ${n(c.gastoDiario)} kcal al día.`);
    if (c.deficit > 0) {
      partes.push(`Si comes un poco menos, usa tu energía guardada: eso es el déficit. Tu meta de ${n(c.meta)} kcal deja un déficit de ${n(c.deficit)} kcal, suficiente para avanzar entre ${c.ritmo.min} y ${c.ritmo.max} kg por semana sin pasar hambre.`);
    } else partes.push(`Tu meta es de ${n(c.meta)} kcal al día, pensada para tu objetivo.`);
    partes.push(`Nunca te recomendaremos menos de ${n(c.minimoSeguro)} kcal, que es tu mínimo seguro.`);
  }

  if (c.consultaMedica) partes.push('Por lo que nos contaste en tu perfil, te conviene consultar a tu médico antes de hacer cambios; yo te acompaño con el día a día.');
  return { texto: partes.join('\n\n'), basadoEnCalculos: basado };
}
