import { analizarDia, Consumo, Meta, sumar } from './analisis';

const meta: Meta = { kcal: 1650, minimoSeguro: 1200, macros: { proteina: 96, carbos: 193, grasa: 55 } };
const c = (nombre: string, kcal: number, sustituto?: Consumo['sustituto']): Consumo => ({ nombre, kcal, p: 10, c: 20, g: 5, sustituto });

describe('sumar', () => {
  it('suma calorías y macronutrientes del día', () => {
    expect(sumar([{ kcal: 180, p: 12, c: 2, g: 14 }, { kcal: 128, p: 3, c: 26, g: 1.5 }, { kcal: 112, p: 6, c: 10, g: 5 }])).toEqual({ kcal: 420, p: 21, c: 38, g: 20.5 });
  });

  it('un día sin registros suma cero', () => {
    expect(sumar([])).toEqual({ kcal: 0, p: 0, c: 0, g: 0 });
  });
});

describe('analizarDia', () => {
  it('sin registros no hay análisis ni sustituto', () => {
    const a = analizarDia([], meta);
    expect(a.estado).toBe('sin_registros');
    expect(a.mayorAporte).toBeNull();
    expect(a.sustituto).toBeNull();
  });

  it('dentro de la meta: sin exceso y sin proponer cambios', () => {
    const a = analizarDia([c('Pechuga', 800), c('Arroz', 700, { nombre: 'Verduras', kcal: 100 })], meta);
    expect(a.estado).toBe('dentro_de_meta');
    expect(a.exceso).toBe(0);
    expect(a.sustituto).toBeNull();
  });

  it('un 5 % arriba de la meta todavía cuenta como dentro', () => {
    expect(analizarDia([c('Comida', 1730)], meta).estado).toBe('dentro_de_meta');
    expect(analizarDia([c('Comida', 1740)], meta).estado).toBe('exceso');
  });

  it('exceso: calcula cuánto, el mayor aporte y el sustituto (caso del front)', () => {
    const a = analizarDia([c('Tacos al pastor', 900), c('Arroz rojo', 798), c('Refresco de cola 600 ml', 252, { nombre: 'Agua mineral con limón', kcal: 0 })], meta);
    expect(a.estado).toBe('exceso');
    expect(a.consumido).toBe(1950);
    expect(a.exceso).toBe(300);
    expect(a.mayorAporte).toEqual({ nombre: 'Refresco de cola 600 ml', kcal: 252 });
    expect(a.sustituto).toEqual({ nombre: 'Agua mineral con limón', kcal: 0, ahorro: 252 });
    expect(a.principales[0]).toEqual({ nombre: 'Tacos al pastor', kcal: 900 });
  });

  it('elige el cambio que más calorías ahorra', () => {
    const a = analizarDia(
      [c('Refresco', 252, { nombre: 'Agua mineral', kcal: 0 }), c('Hamburguesa con papas', 950, { nombre: 'Tacos de pollo', kcal: 330 }), c('Avena', 700)],
      meta,
    );
    expect(a.mayorAporte!.nombre).toBe('Hamburguesa con papas');
    expect(a.sustituto).toEqual({ nombre: 'Tacos de pollo', kcal: 330, ahorro: 620 });
  });

  it('junta las porciones repetidas del mismo alimento', () => {
    const refresco = () => c('Refresco', 252, { nombre: 'Agua mineral', kcal: 0 });
    const a = analizarDia([refresco(), refresco(), c('Comida', 1500)], meta);
    expect(a.mayorAporte).toEqual({ nombre: 'Refresco', kcal: 504 });
    expect(a.sustituto!.ahorro).toBe(504);
  });

  it('exceso sin sustituto en el catálogo: señala el mayor aporte', () => {
    const a = analizarDia([c('Pizza', 1400), c('Postre', 600)], meta);
    expect(a.mayorAporte).toEqual({ nombre: 'Pizza', kcal: 1400 });
    expect(a.sustituto).toBeNull();
    expect(a.mensaje).toContain('Pizza');
  });

  it('avisa si lo registrado queda por debajo del mínimo seguro', () => {
    const a = analizarDia([c('Ensalada', 600)], meta);
    expect(a.estado).toBe('por_debajo_del_minimo');
    expect(a.mensaje).toContain('mínimo');
  });

  it('el día en curso no se marca como bajo: solo informa lo que falta', () => {
    const a = analizarDia([c('Desayuno', 400)], meta, true);
    expect(a.estado).toBe('en_curso');
    expect(a.mensaje).toContain('1250 kcal');
    expect(analizarDia([c('Pizza', 2400)], meta, true).estado).toBe('exceso');
  });

  it('los mensajes no usan lenguaje de culpa ni castigo', () => {
    const casos = [[], [c('Ensalada', 600)], [c('Comida', 1600)], [c('Pizza', 2400)], [c('Refresco', 2400, { nombre: 'Agua', kcal: 0 })]];
    for (const caso of casos) expect(analizarDia(caso, meta).mensaje).not.toMatch(/culpa|castig|mal[oa]?\b|fall|verg|pecado|trampa|gord/i);
  });
});
