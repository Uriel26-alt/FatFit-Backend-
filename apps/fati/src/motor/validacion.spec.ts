import { Contexto } from './contexto';
import { cuotaAgotada, respuestaDeReglas } from './plantillas';
import { cifrasPermitidas, ejerciciosFueraDeLista, validarRespuesta } from './validacion';

const ctx: Contexto = {
  nombre: 'Ana Rodríguez',
  objetivo: 'bajar',
  pesoActualKg: 79.6,
  calculo: {
    imc: 29.2, clasificacion: 'Sobrepeso', gastoBasal: 1500, gastoDiario: 2060, meta: 1650, minimoSeguro: 1200, deficit: 410,
    macros: { proteina: 96, carbos: 193, grasa: 55 }, ritmo: { min: 0.4, max: 0.8 }, consultaMedica: false,
  },
  rutina: {
    nombre: 'Fuerza en casa · bajo impacto',
    nota: 'Rutina sin saltos para cuidar tus rodillas, según tu perfil.',
    hoyEsDiaDeEntreno: true,
    ejerciciosDeHoy: [{ nombre: 'Sentadilla a silla', dosis: '3 series × 10' }, { nombre: 'Estiramientos de piernas y espalda', dosis: '5 min' }],
    ejerciciosPermitidos: ['Sentadilla a silla', 'Puente de glúteo', 'Elevación de talones', 'Estiramientos de piernas y espalda'],
  },
  comidasDeHoy: { consumido: 1060, restantes: 590, alimentos: [{ nombre: 'Huevo revuelto', kcal: 180 }, { nombre: 'Arroz rojo', kcal: 210 }] },
  analisisDeAyer: { estado: 'exceso', consumido: 1950, exceso: 300, mayorAporte: { nombre: 'Refresco de cola 600 ml', kcal: 252 }, sustituto: { nombre: 'Agua mineral con limón', kcal: 0, ahorro: 252 } },
  recomendacionesProfesionista: [],
  catalogoEjercicios: ['Sentadilla a silla', 'Sentadilla libre', 'Sentadilla con salto', 'Puente de glúteo', 'Elevación de talones', 'Trote suave', 'Estiramientos', 'Estiramientos de piernas y espalda'],
};

const motivo = (texto: string) => {
  const v = validarRespuesta(texto, ctx);
  return v.valida ? null : v.motivo;
};

describe('validarRespuesta', () => {
  it('acepta una respuesta que solo usa cifras calculadas y ejercicios de la rutina', () => {
    expect(motivo('Tu meta es de 1,650 kcal y tu cuerpo gasta 2 060 kcal. Si te cuesta la sentadilla a silla, prueba el puente de glúteo.')).toBeNull();
  });

  it('rechaza calorías que el servidor no calculó', () => {
    expect(motivo('Te recomiendo comer 1,400 kcal al día.')).toContain('1400');
    expect(motivo('Con 1800 calorías vas bien.')).toContain('1800');
  });

  it('rechaza cualquier cifra por debajo del mínimo seguro', () => {
    expect(motivo('Prueba bajar a 900 kcal por unos días.')).toContain('mínimo seguro');
  });

  it('acepta las cifras de las comidas y del análisis', () => {
    expect(motivo('Hoy llevas 1060 kcal y te quedan 590 kcal. Ayer el refresco sumó 252 kcal.')).toBeNull();
  });

  it('rechaza ejercicios fuera de la lista filtrada', () => {
    expect(motivo('Puedes cambiarla por sentadilla con salto.')).toContain('Sentadilla con salto');
    expect(motivo('¿Y si sales a hacer trote suave?')).toContain('Trote suave');
  });

  it('un ejercicio permitido no se confunde con otro que comparte nombre', () => {
    expect(ejerciciosFueraDeLista('Termina con estiramientos de piernas y espalda.', ctx)).toEqual([]);
    expect(ejerciciosFueraDeLista('Termina con estiramientos.', ctx)).toEqual(['Estiramientos']);
  });

  it('rechaza lenguaje de culpa o castigo', () => {
    expect(motivo('No te sientas culpable por el refresco.')).toContain('culpa');
    expect(motivo('Mañana compensa con un castigo de cardio.')).toContain('culpa');
    expect(motivo('Evita la comida chatarra.')).toContain('culpa');
  });

  it('rechaza respuestas vacías o demasiado largas', () => {
    expect(motivo('   ')).toBe('respuesta vacía');
    expect(motivo('a'.repeat(3000))).toBe('respuesta demasiado larga');
  });

  it('sin cálculo no se puede citar ninguna cifra de calorías', () => {
    const sinCalculo = { ...ctx, calculo: null, comidasDeHoy: null, analisisDeAyer: null };
    expect(validarRespuesta('Tu meta es de 1650 kcal.', sinCalculo).valida).toBe(false);
    expect(cifrasPermitidas(sinCalculo)).toEqual(new Set([0]));
  });
});

describe('plantillas de reglas', () => {
  const preguntas = ['¿Qué es el déficit calórico?', 'Me cuesta la sentadilla, ¿la puedo cambiar?', 'Ideas de cena', 'hola'];

  it.each(preguntas)('«%s» produce una respuesta que pasa la misma validación que el modelo', (p) => {
    const r = respuestaDeReglas(p, ctx);
    expect(validarRespuesta(r.texto, ctx)).toEqual({ valida: true });
  });

  it('explica la meta con las cifras calculadas', () => {
    const r = respuestaDeReglas('¿Por qué mi meta es esa?', ctx);
    expect(r.basadoEnCalculos).toBe(true);
    expect(r.texto).toContain('1,650 kcal');
    expect(r.texto).toContain('2,060 kcal');
  });

  it('para cambiar un ejercicio solo ofrece los de la rutina', () => {
    const r = respuestaDeReglas('¿Puedo cambiar un ejercicio?', ctx);
    expect(r.texto).toContain('Puente de glúteo');
    expect(r.texto).not.toContain('Sentadilla libre');
  });

  it('la recomendación del profesionista va primero', () => {
    const r = respuestaDeReglas('Ideas de cena', { ...ctx, recomendacionesProfesionista: ['Cena ligera antes de las 8 pm'] });
    expect(r.texto.startsWith('Tu profesionista te indicó')).toBe(true);
  });

  it('con condiciones de riesgo recuerda la consulta médica', () => {
    const r = respuestaDeReglas('hola', { ...ctx, calculo: { ...ctx.calculo!, consultaMedica: true } });
    expect(r.texto).toContain('médico');
  });

  it('sin perfil completo pide terminarlo y no inventa cifras', () => {
    const r = respuestaDeReglas('¿Cuál es mi meta?', { ...ctx, calculo: null });
    expect(r.texto).toContain('perfil');
    expect(r.texto).not.toMatch(/\d+ kcal/);
  });

  it('cuota agotada: dice cuándo se renueva y ofrece subir de plan solo en Básico', () => {
    expect(cuotaAgotada('2026-12-01', 'basico')).toContain('1 de diciembre');
    expect(cuotaAgotada('2026-12-01', 'basico')).toContain('Fati Max o Pro');
    expect(cuotaAgotada('2026-12-01', 'pro')).not.toContain('Fati Max');
  });
});
