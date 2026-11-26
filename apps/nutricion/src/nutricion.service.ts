import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClienteServicios, hoy, sumarDias } from '@app/comun';
import { analizarDia, Consumo, Meta, sumar } from './motor/analisis';
import { ActualizarAlimentoDto, CrearAlimentoDto, RegistrarComidaDto } from './nutricion.dto';
import { Alimento, RegistroComida, TiempoComida, TIEMPOS } from './nutricion.entity';

type ResumenSalud = { calculo: { meta: number; minimoSeguro: number; macros: Meta['macros'] } | null };
const r1 = (n: number) => Math.round(n * 10) / 10;
/** «2 × 1 pieza»; con una sola porción se deja el texto tal cual. */
const textoPorcion = (cantidad: number, porcion: string) => (cantidad === 1 ? porcion : `${cantidad} × ${porcion}`);

@Injectable()
export class NutricionService {
  private readonly log = new Logger('Nutrición');

  constructor(
    @InjectRepository(Alimento) private readonly alimentos: Repository<Alimento>,
    @InjectRepository(RegistroComida) private readonly registros: Repository<RegistroComida>,
    private readonly db: DataSource,
    private readonly servicios: ClienteServicios,
  ) {}

  private aDto(a: Alimento) {
    return {
      id: a.id,
      nombre: a.nombre,
      marca: a.marca,
      categoria: a.categoria,
      porcion: a.porcion,
      kcal: a.kcal,
      p: a.proteinaG,
      c: a.carbosG,
      g: a.grasaG,
      codigoBarras: a.codigoBarras,
      origen: a.origen,
      sustitutoId: a.sustitutoId,
      activo: a.activo,
    };
  }

  // ---------- Catálogo ----------

  async buscar(texto: string | undefined, limite: number, incluirInactivos: boolean) {
    const q = this.alimentos.createQueryBuilder('a').take(Math.min(Math.max(limite || 20, 1), 100));
    if (!incluirInactivos) q.andWhere('a.activo');
    const t = texto?.trim();
    if (t) {
      // Primero los que empiezan con el texto, luego los que lo contienen.
      q.andWhere(`(a.nombre ILIKE :contiene OR a.marca ILIKE :contiene)`, { contiene: `%${t.replace(/[%_]/g, '\\$&')}%` })
        .orderBy(`CASE WHEN a.nombre ILIKE :empieza THEN 0 ELSE 1 END`)
        .setParameter('empieza', `${t.replace(/[%_]/g, '\\$&')}%`)
        .addOrderBy('a.nombre');
    } else q.orderBy('a.categoria').addOrderBy('a.nombre');
    return (await q.getMany()).map((a) => this.aDto(a));
  }

  /** Busca primero en el catálogo propio; si no está, consulta Open Food Facts y lo guarda para la próxima vez. */
  async porCodigo(codigo: string) {
    if (!/^\d{8,14}$/.test(codigo)) throw new BadRequestException('El código de barras debe tener de 8 a 14 dígitos.');
    const local = await this.alimentos.findOneBy({ codigoBarras: codigo });
    if (local) return this.aDto(local);

    const externo = await this.consultarOpenFoodFacts(codigo);
    if (!externo) throw new NotFoundException('No encontramos ese código. Puedes buscar el alimento por nombre.');
    await this.alimentos.upsert({ ...externo, codigoBarras: codigo, origen: 'openfoodfacts', categoria: 'envasados', activo: true }, ['codigoBarras']);
    return this.aDto(await this.alimentos.findOneByOrFail({ codigoBarras: codigo }));
  }

  private async consultarOpenFoodFacts(codigo: string) {
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_es,brands,nutriments,serving_size,serving_quantity`;
      const res = await fetch(url, { headers: { 'user-agent': 'FatFit/1.0 (proyecto escolar)' }, signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const { product: p } = (await res.json()) as { product?: Record<string, any> };
      const nombre: string | undefined = p?.product_name_es || p?.product_name;
      const n = p?.nutriments ?? {};
      if (!nombre || typeof n['energy-kcal_100g'] !== 'number') return null;
      // Si la etiqueta trae porción se usa; si no, valores por 100 g.
      const gramos = Number(p?.serving_quantity);
      const factor = gramos > 0 ? gramos / 100 : 1;
      const por = (clave: string) => r1((Number(n[`${clave}_100g`]) || 0) * factor);
      return {
        nombre: nombre.slice(0, 100),
        marca: (p?.brands as string | undefined)?.split(',')[0]?.trim().slice(0, 60) || null,
        porcion: gramos > 0 ? String(p?.serving_size ?? `${gramos} g`).slice(0, 40) : '100 g',
        kcal: por('energy-kcal'),
        proteinaG: por('proteins'),
        carbosG: por('carbohydrates'),
        grasaG: por('fat'),
      };
    } catch (e) {
      this.log.warn(`Open Food Facts no respondió para ${codigo}: ${(e as Error).message}`);
      return null;
    }
  }

  async crearAlimento(dto: CrearAlimentoDto) {
    await this.validarAlimento(dto);
    const { p, c, g, ...resto } = dto;
    const a = await this.alimentos.save(this.alimentos.create({ ...resto, proteinaG: p, carbosG: c, grasaG: g, origen: 'local', activo: true }));
    return this.aDto(a);
  }

  async actualizarAlimento(id: string, dto: ActualizarAlimentoDto) {
    const a = await this.alimentos.findOneBy({ id });
    if (!a) throw new NotFoundException('No encontramos ese alimento.');
    if (dto.sustitutoId === id) throw new BadRequestException('Un alimento no puede ser su propio sustituto.');
    await this.validarAlimento(dto, id);
    const { p, c, g, ...resto } = dto;
    const cambios = { ...resto, proteinaG: p, carbosG: c, grasaG: g };
    Object.assign(a, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)));
    return this.aDto(await this.alimentos.save(a));
  }

  private async validarAlimento(dto: ActualizarAlimentoDto, propioId?: string) {
    if (dto.sustitutoId && !(await this.alimentos.existsBy({ id: dto.sustitutoId }))) throw new BadRequestException('El sustituto no existe en el catálogo.');
    if (dto.codigoBarras) {
      const otro = await this.alimentos.findOneBy({ codigoBarras: dto.codigoBarras });
      if (otro && otro.id !== propioId) throw new ConflictException('Ya hay un alimento con ese código de barras.');
    }
  }

  // ---------- Registro de comidas ----------

  private validarFecha(fecha = hoy()) {
    if (fecha > hoy()) throw new BadRequestException('La fecha no puede ser futura.');
    return fecha;
  }

  private meta(token: string) {
    return this.servicios.intentar<ResumenSalud>('salud', '/resumen', { token }).then((r) => r?.calculo ?? null);
  }

  /** Comidas del día agrupadas por tiempo, con totales y lo que falta para la meta. */
  async delDia(usuarioId: string, token: string, fechaPedida?: string) {
    const fecha = this.validarFecha(fechaPedida);
    const [filas, meta] = await Promise.all([this.registros.find({ where: { usuarioId, fecha }, order: { creadoEn: 'ASC' } }), this.meta(token)]);
    const items = filas.map((r) => ({ id: r.id, tiempo: r.tiempo, alimentoId: r.alimentoId, nombre: r.nombre, porcion: r.porcion, kcal: r.kcal, p: r.proteinaG, c: r.carbosG, g: r.grasaG }));
    const comidas = Object.fromEntries(TIEMPOS.map((t) => [t, items.filter((i) => i.tiempo === t).map(({ tiempo: _, ...a }) => a)])) as Record<TiempoComida, Omit<(typeof items)[number], 'tiempo'>[]>;
    const totales = sumar(items);
    return {
      fecha,
      comidas,
      totales,
      meta: meta ? { kcal: meta.meta, ...meta.macros } : null,
      restantes: meta ? meta.meta - totales.kcal : null,
    };
  }

  async registrar(usuarioId: string, token: string, dto: RegistrarComidaDto) {
    const fecha = this.validarFecha(dto.fecha);
    const a = await this.alimentos.findOneBy({ id: dto.alimentoId, activo: true });
    if (!a) throw new NotFoundException('Ese alimento no está en el catálogo.');
    const n = dto.cantidad ?? 1;
    // Se guarda una copia de los valores: el historial no cambia si luego se edita el catálogo.
    await this.registros.insert({
      usuarioId,
      fecha,
      tiempo: dto.tiempo,
      alimentoId: a.id,
      cantidad: n,
      nombre: a.nombre,
      porcion: textoPorcion(n, a.porcion),
      kcal: r1(a.kcal * n),
      proteinaG: r1(a.proteinaG * n),
      carbosG: r1(a.carbosG * n),
      grasaG: r1(a.grasaG * n),
    });
    return this.delDia(usuarioId, token, fecha);
  }

  async quitar(usuarioId: string, token: string, id: string) {
    const r = await this.registros.findOneBy({ id, usuarioId });
    if (!r) throw new NotFoundException('No encontramos ese registro.');
    await this.registros.delete(r.id);
    return this.delDia(usuarioId, token, r.fecha);
  }

  // ---------- Análisis ----------

  /** Por omisión analiza ayer, que es el último día completo. */
  async analisis(usuarioId: string, token: string, fechaPedida?: string) {
    const fecha = this.validarFecha(fechaPedida ?? sumarDias(hoy(), -1));
    const calculo = await this.meta(token);
    if (!calculo) throw new ConflictException('Completa tu perfil para tener una meta con la cual comparar.');
    const filas: (Consumo & { sustitutoNombre: string | null; sustitutoKcal: string | null })[] = await this.db.query(
      `SELECT r.nombre, r.kcal::float AS kcal, r.proteina_g::float AS p, r.carbos_g::float AS c, r.grasa_g::float AS g,
              s.nombre AS "sustitutoNombre", (s.kcal * r.cantidad)::float AS "sustitutoKcal"
         FROM nutricion.registros_comida r
         LEFT JOIN nutricion.alimentos a ON a.id = r.alimento_id
         LEFT JOIN nutricion.alimentos s ON s.id = a.sustituto_id AND s.activo
        WHERE r.usuario_id = $1 AND r.fecha = $2`,
      [usuarioId, fecha],
    );
    const consumos: Consumo[] = filas.map(({ sustitutoNombre, sustitutoKcal, ...c }) => ({
      ...c,
      sustituto: sustitutoNombre ? { nombre: sustitutoNombre, kcal: Number(sustitutoKcal) } : null,
    }));
    return { fecha, ...analizarDia(consumos, { kcal: calculo.meta, minimoSeguro: calculo.minimoSeguro, macros: calculo.macros }, fecha === hoy()) };
  }

  /** Días con registro en los últimos 30, para medir constancia. */
  async diasRegistrados(usuarioId: string) {
    const filas: { fecha: string; kcal: number }[] = await this.db.query(
      `SELECT fecha::text, round(sum(kcal))::int AS kcal FROM nutricion.registros_comida
        WHERE usuario_id = $1 AND fecha > $2 GROUP BY fecha ORDER BY fecha`,
      [usuarioId, sumarDias(hoy(), -30)],
    );
    return filas;
  }

  async borrarTodo(usuarioId: string) {
    await this.registros.delete({ usuarioId });
  }
}
