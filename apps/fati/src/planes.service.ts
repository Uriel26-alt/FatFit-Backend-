import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { hoy, inicioSiguientePeriodo, periodoDe } from '@app/comun';
import { ActualizarPlanDto } from './fati.dto';
import { Configuracion, Plan, PlanId, Suscripcion } from './fati.entity';

export type Cuota = { plan: PlanId; usadas: number; limite: number; restantes: number; renuevaEl: string };

@Injectable()
export class PlanesService {
  constructor(
    @InjectRepository(Plan) private readonly planes: Repository<Plan>,
    @InjectRepository(Suscripcion) private readonly suscripciones: Repository<Suscripcion>,
    @InjectRepository(Configuracion) private readonly config: Repository<Configuracion>,
    private readonly db: DataSource,
  ) {}

  private aDto(p: Plan) {
    return { id: p.id, nombre: p.nombre, precioMensual: p.precioMensual, moneda: p.moneda, cuotaFati: p.cuotaFati, resumen: p.resumen, beneficios: p.beneficios, incluyeProfesionista: p.incluyeProfesionista };
  }

  async listar() {
    return (await this.planes.find({ order: { orden: 'ASC' } })).map((p) => this.aDto(p));
  }

  async actualizar(id: string, dto: ActualizarPlanDto) {
    const p = await this.planes.findOneBy({ id: id as PlanId });
    if (!p) throw new NotFoundException('Ese plan no existe.');
    Object.assign(p, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.aDto(await this.planes.save(p));
  }

  /** Plan vigente del usuario. Quien nunca ha contratado nada está en Básico. */
  async planDe(usuarioId: string) {
    const s = await this.suscripciones.findOneBy({ usuarioId, estado: 'activa' });
    const plan = await this.planes.findOneByOrFail({ id: s?.planId ?? 'basico' });
    return { plan, desde: s?.inicio ?? null };
  }

  async suscripcion(usuarioId: string) {
    const { plan, desde } = await this.planDe(usuarioId);
    return { plan: this.aDto(plan), desde, cuota: await this.cuota(usuarioId, plan) };
  }

  /** Cambio de plan inmediato. El cobro está simulado hasta integrar Stripe / RevenueCat. */
  async cambiar(usuarioId: string, planId: PlanId) {
    const { plan } = await this.planDe(usuarioId);
    if (plan.id !== planId) {
      await this.db.transaction(async (tx) => {
        await tx.update(Suscripcion, { usuarioId, estado: 'activa' }, { estado: 'terminada', fin: new Date() });
        await tx.insert(Suscripcion, { usuarioId, planId, estado: 'activa', proveedor: 'simulado' });
      });
    }
    return this.suscripcion(usuarioId);
  }

  // ---------- Cuota de Fati ----------

  async cuota(usuarioId: string, plan?: Plan): Promise<Cuota> {
    const p = plan ?? (await this.planDe(usuarioId)).plan;
    const fecha = hoy();
    const [fila]: { peticiones: number }[] = await this.db.query(`SELECT peticiones FROM fati.uso_ia WHERE usuario_id = $1 AND periodo = $2`, [usuarioId, periodoDe(fecha)]);
    const usadas = fila?.peticiones ?? 0;
    return { plan: p.id, usadas, limite: p.cuotaFati, restantes: Math.max(0, p.cuotaFati - usadas), renuevaEl: inicioSiguientePeriodo(fecha) };
  }

  /**
   * Aparta una petición del mes. La comparación contra el límite y el incremento
   * ocurren en una sola sentencia, así dos peticiones simultáneas no pueden
   * rebasar la cuota. Devuelve false si ya no queda.
   */
  async consumir(usuarioId: string): Promise<{ ok: boolean; cuota: Cuota }> {
    const { plan } = await this.planDe(usuarioId);
    let ok = false;
    if (plan.cuotaFati > 0) {
      const filas: unknown[] = await this.db.query(
        `INSERT INTO fati.uso_ia AS u (usuario_id, periodo, peticiones) VALUES ($1, $2, 1)
         ON CONFLICT (usuario_id, periodo) DO UPDATE SET peticiones = u.peticiones + 1 WHERE u.peticiones < $3
         RETURNING peticiones`,
        [usuarioId, periodoDe(hoy()), plan.cuotaFati],
      );
      ok = filas.length > 0;
    }
    return { ok, cuota: await this.cuota(usuarioId, plan) };
  }

  /** Devuelve la petición apartada cuando no se pudo atender. */
  async devolver(usuarioId: string) {
    await this.db.query(`UPDATE fati.uso_ia SET peticiones = greatest(peticiones - 1, 0) WHERE usuario_id = $1 AND periodo = $2`, [usuarioId, periodoDe(hoy())]);
  }

  // ---------- Configuración y métricas (admin) ----------

  listarConfiguracion() {
    return this.config.find({ order: { clave: 'ASC' } });
  }

  async valor<T>(clave: string, porOmision: T): Promise<T> {
    const c = await this.config.findOneBy({ clave });
    return (c?.valor as T) ?? porOmision;
  }

  async guardarConfiguracion(clave: string, valor: unknown) {
    const c = await this.config.findOneBy({ clave });
    if (!c) throw new NotFoundException('Esa clave de configuración no existe.');
    c.valor = valor;
    return this.config.save(c);
  }

  /** Solo cifras agregadas y anónimas: el administrador no ve datos de personas. */
  async metricas() {
    const periodo = periodoDe(hoy());
    const [uso]: { usuarios: number; peticiones: number }[] = await this.db.query(
      `SELECT count(*)::int AS usuarios, coalesce(sum(peticiones), 0)::int AS peticiones FROM fati.uso_ia WHERE periodo = $1 AND peticiones > 0`,
      [periodo],
    );
    const porPlan: { plan: string; suscripciones: number }[] = await this.db.query(
      `SELECT p.id AS plan, count(s.id)::int AS suscripciones FROM fati.planes p
         LEFT JOIN fati.suscripciones s ON s.plan_id = p.id AND s.estado = 'activa' GROUP BY p.id, p.orden ORDER BY p.orden`,
    );
    return { periodo, consumoIa: { usuariosConUso: uso.usuarios, peticiones: uso.peticiones }, suscripcionesActivas: porPlan };
  }

  async borrarTodo(usuarioId: string) {
    await this.db.transaction(async (tx) => {
      await tx.query(`DELETE FROM fati.mensajes WHERE usuario_id = $1`, [usuarioId]);
      await tx.query(`DELETE FROM fati.uso_ia WHERE usuario_id = $1`, [usuarioId]);
      await tx.query(`DELETE FROM fati.suscripciones WHERE usuario_id = $1`, [usuarioId]);
    });
  }
}
