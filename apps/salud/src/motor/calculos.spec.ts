import {
  clasificarImc,
  gastoBasal,
  gastoDiario,
  imc,
  metaCalorica,
  metaMacros,
  MINIMO_SEGURO,
  PerfilFisico,
  requiereBajoImpacto,
  requiereConsultaMedica,
  resumen,
  ritmoSeguro,
} from './calculos';

/** Ana, la usuaria de ejemplo del front. */
const ana: PerfilFisico = { edad: 34, sexo: 'mujer', alturaCm: 165, pesoKg: 79.6, nivelActividad: 'ligero', objetivo: 'bajar', condiciones: ['rodilla'] };
const con = (cambios: Partial<PerfilFisico>): PerfilFisico => ({ ...ana, ...cambios });

describe('IMC', () => {
  it('calcula peso / altura² con un decimal', () => {
    expect(imc(79.6, 165)).toBe(29.2);
    expect(imc(70, 175)).toBe(22.9);
  });

  it.each([
    [18.4, 'Bajo peso'],
    [18.5, 'Normal'],
    [24.9, 'Normal'],
    [25, 'Sobrepeso'],
    [30, 'Obesidad I'],
    [35, 'Obesidad II'],
    [40, 'Obesidad III'],
  ])('clasifica %s como %s', (valor, esperado) => expect(clasificarImc(valor)).toBe(esperado));
});

describe('Gasto calórico (Mifflin-St Jeor)', () => {
  it('mujer: 10·peso + 6.25·altura − 5·edad − 161', () => {
    expect(gastoBasal(ana)).toBeCloseTo(796 + 1031.25 - 170 - 161, 5);
  });

  it('hombre: misma base + 5', () => {
    expect(gastoBasal(con({ sexo: 'hombre' })) - gastoBasal(ana)).toBe(166);
  });

  it('el gasto diario multiplica por el factor de actividad', () => {
    expect(gastoDiario(con({ nivelActividad: 'sedentario' }))).toBeCloseTo(gastoBasal(ana) * 1.2, 5);
    expect(gastoDiario(con({ nivelActividad: 'muyActivo' }))).toBeCloseTo(gastoBasal(ana) * 1.9, 5);
  });
});

describe('Meta diaria de calorías', () => {
  it('bajar: déficit del 20 % redondeado a decenas', () => {
    // 1496.25 × 1.375 = 2057.3 → −20 % = 1645.9 → 1650
    expect(metaCalorica(ana)).toBe(1650);
  });

  it('bajar: el déficit nunca pasa de 750 kcal', () => {
    const grande = con({ sexo: 'hombre', pesoKg: 150, alturaCm: 190, nivelActividad: 'muyActivo' });
    expect(Math.round(gastoDiario(grande)) - metaCalorica(grande)).toBeLessThanOrEqual(755);
    expect(gastoDiario(grande) * 0.2).toBeGreaterThan(750);
  });

  it('mantener: igual al gasto diario', () => {
    expect(metaCalorica(con({ objetivo: 'mantener' }))).toBe(2060);
  });

  it('ganar: superávit del 10 %', () => {
    expect(metaCalorica(con({ objetivo: 'ganar' }))).toBe(2260);
  });

  it('nunca baja del mínimo seguro', () => {
    const pequena = con({ pesoKg: 48, alturaCm: 150, edad: 60, nivelActividad: 'sedentario' });
    expect(gastoDiario(pequena) * 0.8).toBeLessThan(MINIMO_SEGURO.mujer);
    expect(metaCalorica(pequena)).toBe(1200);
    expect(metaCalorica(con({ sexo: 'hombre', pesoKg: 55, alturaCm: 160, edad: 70, nivelActividad: 'sedentario' }))).toBe(1500);
  });

  it('sin déficit en embarazo ni con bajo peso, aunque el objetivo sea bajar', () => {
    expect(metaCalorica(con({ condiciones: ['embarazo'] }))).toBe(2060);
    const bajoPeso = con({ pesoKg: 48, alturaCm: 170, condiciones: [] });
    expect(metaCalorica(bajoPeso)).toBe(Math.round(gastoDiario(bajoPeso) / 10) * 10);
  });
});

describe('Macronutrientes y ritmo', () => {
  it('1.2 g de proteína por kg en déficit y 1 g en los demás objetivos', () => {
    expect(metaMacros(1650, ana).proteina).toBe(96);
    expect(metaMacros(2060, con({ objetivo: 'mantener' })).proteina).toBe(80);
  });

  it('30 % de grasa y el resto carbohidratos: la suma da la meta', () => {
    const m = metaMacros(1650, ana);
    expect(m.grasa).toBe(55);
    expect(Math.abs(m.proteina * 4 + m.carbos * 4 + m.grasa * 9 - 1650)).toBeLessThanOrEqual(4);
  });

  it('ritmo seguro entre 0.5 % y 1 % del peso por semana', () => {
    expect(ritmoSeguro(80)).toEqual({ min: 0.4, max: 0.8 });
  });
});

describe('Reglas de seguridad', () => {
  it.each(['embarazo', 'cardiopatia', 'diabetes'] as const)('%s pide consulta médica desde el primer día', (c) => {
    expect(requiereConsultaMedica(con({ condiciones: [c] }))).toBe(true);
  });

  it('IMC extremo pide consulta médica', () => {
    expect(requiereConsultaMedica(con({ pesoKg: 110, condiciones: [] }))).toBe(true); // IMC 40.4
    expect(requiereConsultaMedica(con({ pesoKg: 43, condiciones: [] }))).toBe(true); // IMC 15.8
  });

  it('rodilla, lumbar o hipertensión no la exigen por sí solas', () => {
    expect(requiereConsultaMedica(con({ condiciones: ['rodilla', 'lumbar', 'hipertension'] }))).toBe(false);
  });

  it('bajo impacto con cualquier condición o IMC de 35 o más', () => {
    expect(requiereBajoImpacto(ana)).toBe(true);
    expect(requiereBajoImpacto(con({ condiciones: [] }))).toBe(false);
    expect(requiereBajoImpacto(con({ condiciones: [], pesoKg: 96 }))).toBe(true); // IMC 35.3
  });
});

describe('Resumen', () => {
  it('junta todos los resultados del cálculo base', () => {
    expect(resumen(ana)).toEqual({
      imc: 29.2,
      clasificacion: 'Sobrepeso',
      gastoBasal: 1500,
      gastoDiario: 2060,
      meta: 1650,
      minimoSeguro: 1200,
      deficit: 410,
      macros: { proteina: 96, carbos: 193, grasa: 55 },
      ritmo: { min: 0.4, max: 0.8 },
      consultaMedica: false,
      bajoImpacto: true,
    });
  });
});
