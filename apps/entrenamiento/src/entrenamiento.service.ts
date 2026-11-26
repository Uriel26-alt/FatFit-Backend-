import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClienteServicios, diaSemana, hoy, lunesDe, sumarDias } from '@app/comun';
import { ActualizarEjercicioDto, CrearEjercicioDto } from './entrenamiento.dto';
import { Ejercicio, Rutina, RutinaEjercicio, Sesion } from './entrenamiento.entity';
import { armarRutina, Parametros } from './motor/rutinas';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
type EstadoDia = 'hecho' | 'hoy' | 'pendiente' | 'descanso';
type ResumenSalud = {
  perfil: { minutos: number; lugar: Parametros['lugar']; nivelActividad: Parametros['nivelActividad'] | null; condiciones: string[] };
  calculo: { bajoImpacto: boolean } | null;
};
/** Texto comparable de los parámetros (jsonb no conserva el orden de las llaves). */
const canonico = (p: Parametros) => JSON.stringify([p.minutos, p.lugar, p.nivelActividad, [...p.condiciones].sort(), p.bajoImpacto]);
type FilaRutina = { diaSemana: number; id: string; nombre: string; dosis: string; icono: string };

@Injectable()
export class EntrenamientoService {
  constructor(
    @InjectRepository(Ejercicio) private readonly ejercicios: Repository<Ejercicio>,
    @InjectRepository(Rutina) private readonly rutinas: Repository<Rutina>,
    @InjectRepository(Sesion) private readonly sesiones: Repository<Sesion>,
    private readonly db: DataSource,
    private readonly servicios: ClienteServicios,
  ) {}

  // ---------- Rutina ----------

  /** Datos del perfil (servicio de salud) que definen la rutina. */
  private async parametros(token: string): Promise<Parametros> {
    const { perfil, calculo } = await this.servicios.pedir<ResumenSalud>('salud', '/resumen', { token });
    if (!calculo || !perfil.nivelActividad) throw new ConflictException('Completa tu perfil para armar tu rutina.');
    return {
      minutos: perfil.minutos,
      lugar: perfil.lugar,
      nivelActividad: perfil.nivelActividad,
      condiciones: [...perfil.condiciones].sort(),
      bajoImpacto: calculo.bajoImpacto,
    };
  }

  /** Arma una rutina nueva con el perfil actual y la deja como la activa. */
  async generar(usuarioId: string, token: string, parametros?: Parametros) {
    const p = parametros ?? (await this.parametros(token));
    const catalogo = await this.ejercicios.findBy({ activo: true });
    const r = armarRutina(catalogo, p);
    return this.db.transaction(async (tx) => {
      await tx.update(Rutina, { usuarioId, activa: true }, { activa: false });
      const rutina = await tx.save(
        Rutina,
        tx.create(Rutina, { usuarioId, nombre: r.nombre, minutos: r.minutos, equipo: r.equipo, nota: r.nota, sesionesSemana: r.sesionesSemana, parametros: p, activa: true }),
      );
      await tx.insert(
        RutinaEjercicio,
        r.dias.flatMap((d) => d.ejercicios.map((e, orden) => ({ rutinaId: rutina.id, diaSemana: d.diaSemana, orden, ejercicioId: e.ejercicioId, dosis: e.dosis }))),
      );
      return rutina;
    });
  }

  /** Rutina activa. Se regenera sola si aún no existe o si el perfil cambió (minutos, lugar, condiciones, peso…). */
  private async activa(usuarioId: string, token: string) {
    const p = await this.parametros(token);
    const actual = await this.rutinas.findOneBy({ usuarioId, activa: true });
    const igual = actual && canonico(actual.parametros) === canonico(p);
    const rutina = actual && igual ? actual : await this.generar(usuarioId, token, p);
    const filas: FilaRutina[] = await this.db.query(
      `SELECT re.dia_semana AS "diaSemana", e.id, e.nombre, re.dosis, e.icono
         FROM entrenamiento.rutina_ejercicios re JOIN entrenamiento.ejercicios e ON e.id = re.ejercicio_id
        WHERE re.rutina_id = $1 ORDER BY re.dia_semana, re.orden`,
      [rutina.id],
    );
    return { rutina, filas };
  }

  private deDia(filas: FilaRutina[], dia: number) {
    return filas.filter((f) => f.diaSemana === dia).map(({ id, nombre, dosis, icono }) => ({ id, nombre, dosis, icono }));
  }

  private cabecera(r: Rutina) {
    return { id: r.id, nombre: r.nombre, minutos: r.minutos, equipo: r.equipo, nota: r.nota, sesionesSemana: r.sesionesSemana };
  }

  async semana(usuarioId: string, token: string) {
    const { rutina, filas } = await this.activa(usuarioId, token);
    const dias = [...new Set(filas.map((f) => f.diaSemana))].map((d) => ({ diaSemana: d, dia: DIAS[d - 1], ejercicios: this.deDia(filas, d) }));
    return { ...this.cabecera(rutina), creadaEn: rutina.creadoEn, dias };
  }

  /** Lo que muestra la pestaña Entrenar: la sesión de hoy, lo ya marcado y el estado de la semana. */
  async rutinaDeHoy(usuarioId: string, token: string) {
    const { rutina, filas } = await this.activa(usuarioId, token);
    const fecha = hoy();
    const lunes = lunesDe(fecha);
    const sesiones = await this.db.query<{ fecha: string; completada: boolean; hechos: string[] }[]>(
      `SELECT fecha::text, completada, ejercicios_completados AS hechos FROM entrenamiento.sesiones_completadas
        WHERE usuario_id = $1 AND fecha BETWEEN $2 AND $3`,
      [usuarioId, lunes, sumarDias(lunes, 6)],
    );
    const diasEntreno = [...new Set(filas.map((f) => f.diaSemana))];
    const semana = DIAS.map((dia, i) => {
      const f = sumarDias(lunes, i);
      let estado: EstadoDia = 'pendiente';
      if (sesiones.find((s) => s.fecha === f)?.completada) estado = 'hecho';
      else if (!diasEntreno.includes(i + 1)) estado = 'descanso';
      else if (f === fecha) estado = 'hoy';
      return { dia, fecha: f, estado };
    });

    const dia = diaSemana(fecha);
    const ejercicios = this.deDia(filas, dia);
    const sesionHoy = sesiones.find((s) => s.fecha === fecha);
    return {
      ...this.cabecera(rutina),
      fecha,
      esDiaDeEntreno: ejercicios.length > 0,
      /** Número de sesión dentro de la semana (1 = primera). 0 en día de descanso. */
      diaSemana: diasEntreno.indexOf(dia) + 1,
      ejercicios,
      completados: (sesionHoy?.hechos ?? []).filter((id) => ejercicios.some((e) => e.id === id)),
      completada: sesionHoy?.completada ?? false,
      semana,
    };
  }

  /** Marca o desmarca un ejercicio de hoy. La sesión queda completada cuando están todos. */
  async alternar(usuarioId: string, token: string, ejercicioId: string) {
    const { rutina, filas } = await this.activa(usuarioId, token);
    const fecha = hoy();
    const deHoy = this.deDia(filas, diaSemana(fecha)).map((e) => e.id);
    if (!deHoy.includes(ejercicioId)) throw new NotFoundException('Ese ejercicio no está en tu rutina de hoy.');

    await this.db.transaction(async (tx) => {
      // La fila se crea si no existe y luego se bloquea, para que dos toques seguidos no se pisen.
      await tx.query(
        `INSERT INTO entrenamiento.sesiones_completadas (usuario_id, rutina_id, fecha) VALUES ($1, $2, $3) ON CONFLICT (usuario_id, fecha) DO NOTHING`,
        [usuarioId, rutina.id, fecha],
      );
      const s = await tx.findOneOrFail(Sesion, { where: { usuarioId, fecha }, lock: { mode: 'pessimistic_write' } });
      const hechos = s.ejerciciosCompletados.includes(ejercicioId) ? s.ejerciciosCompletados.filter((id) => id !== ejercicioId) : [...s.ejerciciosCompletados, ejercicioId];
      await tx.update(Sesion, s.id, { rutinaId: rutina.id, ejerciciosCompletados: hechos, completada: deHoy.every((id) => hechos.includes(id)) });
    });
    return this.rutinaDeHoy(usuarioId, token);
  }

  // ---------- Seguimiento ----------

  historial(usuarioId: string) {
    return this.sesiones.find({
      where: { usuarioId },
      order: { fecha: 'DESC' },
      take: 120,
      select: { id: true, fecha: true, completada: true, ejerciciosCompletados: true },
    });
  }

  /** Entrenos totales y racha: días seguidos sin faltar a una sesión programada (los descansos no la rompen). */
  async estadisticas(usuarioId: string) {
    const fecha = hoy();
    const filas = await this.db.query<{ fecha: string }[]>(
      `SELECT fecha::text FROM entrenamiento.sesiones_completadas WHERE usuario_id = $1 AND completada ORDER BY fecha DESC`,
      [usuarioId],
    );
    const hechas = new Set(filas.map((f) => f.fecha));
    const activa = await this.rutinas.findOneBy({ usuarioId, activa: true });
    const programados: { d: number }[] = activa
      ? await this.db.query(`SELECT DISTINCT dia_semana AS d FROM entrenamiento.rutina_ejercicios WHERE rutina_id = $1`, [activa.id])
      : [];
    const diasEntreno = programados.map((p) => p.d);

    let inicio: string | null = null;
    for (let i = 0; i < 366; i++) {
      const f = sumarDias(fecha, -i);
      if (hechas.has(f)) inicio = f;
      else if (i > 0 && diasEntreno.includes(diaSemana(f))) break; // faltó a una sesión
    }
    const rachaDias = inicio ? Math.round((Date.parse(fecha) - Date.parse(inicio)) / 86_400_000) + 1 : 0;
    const lunes = lunesDe(fecha);
    return { rachaDias, entrenosTotales: hechas.size, entrenosSemana: [...hechas].filter((f) => f >= lunes).length };
  }

  // ---------- Catálogo ----------

  listarEjercicios(filtros: { tipo?: string; equipo?: string; grupo?: string }, incluirInactivos: boolean) {
    const q = this.ejercicios.createQueryBuilder('e').orderBy('e.tipo').addOrderBy('e.grupoMuscular').addOrderBy('e.nombre');
    if (!incluirInactivos) q.andWhere('e.activo');
    if (filtros.tipo) q.andWhere('e.tipo = :tipo', filtros);
    if (filtros.equipo) q.andWhere('e.equipo = :equipo', filtros);
    if (filtros.grupo) q.andWhere('e.grupoMuscular = :grupo', filtros);
    return q.getMany();
  }

  async crearEjercicio(dto: CrearEjercicioDto) {
    if (await this.ejercicios.existsBy({ nombre: dto.nombre })) throw new ConflictException('Ya hay un ejercicio con ese nombre.');
    return this.ejercicios.save(this.ejercicios.create({ ...dto, activo: true }));
  }

  async actualizarEjercicio(id: string, dto: ActualizarEjercicioDto) {
    const e = await this.ejercicios.findOneBy({ id });
    if (!e) throw new NotFoundException('No encontramos ese ejercicio.');
    Object.assign(e, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.ejercicios.save(e);
  }

  async borrarTodo(usuarioId: string) {
    await this.sesiones.delete({ usuarioId });
    await this.rutinas.delete({ usuarioId }); // rutina_ejercicios cae en cascada
  }
}
