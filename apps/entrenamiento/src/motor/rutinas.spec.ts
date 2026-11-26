import { armarRutina, EjercicioCatalogo, Equipo, filtrarCatalogo, Parametros, TipoEjercicio } from './rutinas';

let n = 0;
const ej = (nombre: string, tipo: TipoEjercicio, grupo: string, extra: Partial<EjercicioCatalogo> = {}): EjercicioCatalogo => ({
  id: `e${++n}`,
  nombre,
  tipo,
  grupoMuscular: grupo,
  nivel: 1,
  equipo: 'ninguno' as Equipo,
  impacto: 'bajo',
  alAireLibre: true,
  contraindicaciones: [],
  minutos: tipo === 'cardio' ? 10 : 5,
  dosis: tipo === 'fuerza' ? '3 series × 10' : '5 min',
  icono: 'entrenar',
  ...extra,
});

const catalogo: EjercicioCatalogo[] = [
  ej('Marcha', 'calentamiento', 'cuerpo_completo'),
  ej('Saltos de tijera', 'calentamiento', 'cuerpo_completo', { impacto: 'alto', nivel: 2, contraindicaciones: ['rodilla', 'embarazo'] }),
  ej('Sentadilla a silla', 'fuerza', 'piernas'),
  ej('Sentadilla libre', 'fuerza', 'piernas', { nivel: 2, contraindicaciones: ['rodilla'] }),
  ej('Sentadilla con salto', 'fuerza', 'piernas', { nivel: 3, impacto: 'alto', contraindicaciones: ['rodilla'] }),
  ej('Prensa', 'fuerza', 'piernas', { equipo: 'gimnasio', alAireLibre: false, contraindicaciones: ['rodilla'] }),
  ej('Flexiones en pared', 'fuerza', 'pecho'),
  ej('Press con mancuernas', 'fuerza', 'pecho', { equipo: 'basico', nivel: 2, alAireLibre: false }),
  ej('Puente de glúteo', 'fuerza', 'gluteos', { alAireLibre: false }),
  ej('Ángeles de pared', 'fuerza', 'espalda'),
  ej('Jalón en polea', 'fuerza', 'espalda', { equipo: 'gimnasio', alAireLibre: false }),
  ej('Plancha con rodillas', 'fuerza', 'core', { alAireLibre: false, contraindicaciones: ['embarazo'] }),
  ej('Pájaro-perro', 'fuerza', 'core', { alAireLibre: false }),
  ej('Círculos de brazos', 'fuerza', 'hombros'),
  ej('Caminata', 'cardio', 'cuerpo_completo'),
  ej('Trote', 'cardio', 'cuerpo_completo', { nivel: 2, impacto: 'alto', contraindicaciones: ['rodilla'] }),
  ej('Estiramientos', 'estiramiento', 'cuerpo_completo'),
];

const base: Parametros = { minutos: 30, lugar: 'casa', nivelActividad: 'ligero', condiciones: [], bajoImpacto: false };
const nombres = (p: Partial<Parametros>) => filtrarCatalogo(catalogo, { ...base, ...p }).map((e) => e.nombre);
const todos = (p: Partial<Parametros>) => armarRutina(catalogo, { ...base, ...p }).dias.flatMap((d) => d.ejercicios.map((e) => e.nombre));

describe('filtrarCatalogo', () => {
  it('un problema de rodilla excluye los ejercicios contraindicados y los de impacto', () => {
    const r = nombres({ condiciones: ['rodilla'], bajoImpacto: true, nivelActividad: 'activo', lugar: 'gimnasio' });
    expect(r).not.toEqual(expect.arrayContaining(['Sentadilla libre']));
    for (const prohibido of ['Sentadilla libre', 'Sentadilla con salto', 'Prensa', 'Trote', 'Saltos de tijera']) expect(r).not.toContain(prohibido);
    expect(r).toContain('Sentadilla a silla');
  });

  it('en casa sin equipo no aparecen mancuernas ni máquinas', () => {
    const r = nombres({ nivelActividad: 'activo' });
    expect(r).not.toContain('Press con mancuernas');
    expect(r).not.toContain('Prensa');
  });

  it('con equipo básico sí hay mancuernas pero no máquinas', () => {
    const r = nombres({ lugar: 'casaEquipo', nivelActividad: 'moderado' });
    expect(r).toContain('Press con mancuernas');
    expect(r).not.toContain('Jalón en polea');
  });

  it('respeta el nivel: un principiante no recibe ejercicios intermedios ni avanzados', () => {
    const r = nombres({ nivelActividad: 'sedentario', lugar: 'gimnasio' });
    expect(r).not.toContain('Sentadilla libre');
    expect(r).not.toContain('Sentadilla con salto');
  });

  it('bajo impacto quita los saltos aunque no haya contraindicación declarada', () => {
    expect(nombres({ bajoImpacto: true, nivelActividad: 'activo' })).not.toContain('Sentadilla con salto');
    expect(nombres({ bajoImpacto: false, nivelActividad: 'activo' })).toContain('Sentadilla con salto');
  });

  it('en el parque solo quedan ejercicios al aire libre', () => {
    expect(nombres({ lugar: 'parque' })).not.toContain('Puente de glúteo');
  });
});

describe('armarRutina', () => {
  it('30 minutos: calentamiento, 4 ejercicios y estiramiento, 3 días por semana', () => {
    const r = armarRutina(catalogo, base);
    expect(r.sesionesSemana).toBe(3);
    expect(r.dias.map((d) => d.diaSemana)).toEqual([1, 3, 5]);
    for (const d of r.dias) {
      expect(d.ejercicios).toHaveLength(6);
      expect(d.ejercicios[0].nombre).toBe('Marcha');
      expect(d.ejercicios.at(-1)!.nombre).toBe('Estiramientos');
    }
  });

  it('más tiempo disponible, más ejercicios; menos tiempo, sesión corta', () => {
    const corta = armarRutina(catalogo, { ...base, minutos: 15 });
    const larga = armarRutina(catalogo, { ...base, minutos: 60 });
    expect(corta.dias[0].ejercicios).toHaveLength(4);
    expect(corta.dias[0].ejercicios[0].dosis).toBe('3 min');
    expect(larga.dias[0].ejercicios.length).toBeGreaterThan(armarRutina(catalogo, base).dias[0].ejercicios.length);
  });

  it('más actividad declarada, más días de entrenamiento', () => {
    expect(armarRutina(catalogo, { ...base, nivelActividad: 'moderado' }).sesionesSemana).toBe(4);
    expect(armarRutina(catalogo, { ...base, nivelActividad: 'muyActivo' }).sesionesSemana).toBe(5);
  });

  it('nunca incluye ejercicios fuera de la lista filtrada', () => {
    const p = { condiciones: ['rodilla', 'embarazo'], bajoImpacto: true, nivelActividad: 'activo' as const, lugar: 'gimnasio' as const, minutos: 60 };
    const permitidos = nombres(p);
    for (const nombre of todos(p)) expect(permitidos).toContain(nombre);
    expect(todos(p)).not.toContain('Plancha con rodillas');
  });

  it('no repite un ejercicio dentro del mismo día', () => {
    for (const d of armarRutina(catalogo, { ...base, minutos: 60, lugar: 'gimnasio' }).dias) {
      const ids = d.ejercicios.map((e) => e.ejercicioId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('aprovecha el equipo disponible', () => {
    expect(todos({ lugar: 'gimnasio' })).toContain('Jalón en polea');
  });

  it('en el parque o con sesiones largas agrega cardio', () => {
    expect(todos({ lugar: 'parque' })).toContain('Caminata');
    expect(todos({ minutos: 45 })).toContain('Caminata');
    expect(todos({ minutos: 30 })).not.toContain('Caminata');
  });

  it('nombre y nota explican la adaptación', () => {
    const r = armarRutina(catalogo, { ...base, condiciones: ['rodilla'], bajoImpacto: true });
    expect(r.nombre).toBe('Fuerza en casa · bajo impacto');
    expect(r.nota).toContain('rodillas');
    expect(armarRutina(catalogo, base).nombre).toBe('Fuerza en casa');
  });

  it('es determinista: el mismo perfil produce la misma rutina', () => {
    expect(armarRutina(catalogo, base)).toEqual(armarRutina(catalogo, base));
  });
});
