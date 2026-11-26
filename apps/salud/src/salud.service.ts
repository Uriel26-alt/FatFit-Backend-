import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { hoy } from '@app/comun';
import { PerfilFisico, resumen } from './motor/calculos';
import { ActualizarPerfilDto } from './salud.dto';
import { CondicionSalud, Medicion, PerfilSalud, Recomendacion } from './salud.entity';

const TEXTO_CONSULTA_MEDICA =
  'Por lo que nos contaste en tu perfil, te recomendamos consultar a un profesional de la salud antes de cambiar tu alimentación o tu ejercicio. ' +
  'FatFit te acompaña, pero no sustituye una valoración médica.';

@Injectable()
export class SaludService {
  constructor(
    @InjectRepository(PerfilSalud) private readonly perfiles: Repository<PerfilSalud>,
    @InjectRepository(CondicionSalud) private readonly condiciones: Repository<CondicionSalud>,
    @InjectRepository(Medicion) private readonly mediciones: Repository<Medicion>,
    @InjectRepository(Recomendacion) private readonly recomendaciones: Repository<Recomendacion>,
    private readonly db: DataSource,
  ) {}

  /** Perfil con la forma que usa el front. Si el usuario aún no contesta nada, devuelve el perfil vacío. */
  async perfil(usuarioId: string) {
    const [p, conds] = await Promise.all([this.perfiles.findOneBy({ usuarioId }), this.condiciones.findBy({ usuarioId })]);
    const perfil = {
      edad: p?.edad ?? null,
      sexo: p?.sexo ?? null,
      alturaCm: p?.alturaCm ?? null,
      pesoInicialKg: p?.pesoInicialKg ?? null,
      nivelActividad: p?.nivelActividad ?? null,
      objetivo: p?.objetivo ?? null,
      lugar: p?.lugar ?? ('casa' as const),
      minutos: p?.minutos ?? 30,
      condiciones: conds.map((c) => c.condicion).sort(),
      condicionOtra: p?.condicionOtra ?? '',
      alimentos: p?.alimentos ?? [],
      alimentoOtro: p?.alimentoOtro ?? '',
    };
    // Completo = todo lo que el motor necesita para calcular.
    const completo = [perfil.edad, perfil.sexo, perfil.alturaCm, perfil.pesoInicialKg, perfil.nivelActividad, perfil.objetivo].every((v) => v !== null);
    return { ...perfil, completo };
  }

  async actualizarPerfil(usuarioId: string, dto: ActualizarPerfilDto) {
    const { condiciones, ...campos } = dto;
    await this.db.transaction(async (tx) => {
      // Solo se tocan los campos que sí llegaron en la petición.
      const enviados = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
      const actual = await tx.findOneBy(PerfilSalud, { usuarioId });
      await tx.save(PerfilSalud, Object.assign(actual ?? tx.create(PerfilSalud, { usuarioId }), enviados));
      const p = await tx.findOneByOrFail(PerfilSalud, { usuarioId });

      if (condiciones) {
        await tx.delete(CondicionSalud, { usuarioId });
        if (condiciones.length) await tx.insert(CondicionSalud, condiciones.map((condicion) => ({ usuarioId, condicion })));
      }
      // El embarazo solo aplica a mujeres: si cambia el sexo, se retira.
      if (p.sexo === 'hombre') await tx.delete(CondicionSalud, { usuarioId, condicion: 'embarazo' });

      // El peso inicial abre el historial de mediciones.
      if (p.pesoInicialKg !== null && !(await tx.existsBy(Medicion, { usuarioId }))) {
        await tx.insert(Medicion, { usuarioId, fecha: hoy(), pesoKg: p.pesoInicialKg });
      }
    });
    await this.sincronizarRecomendaciones(usuarioId);
    return this.perfil(usuarioId);
  }

  /** Perfil + peso actual + cálculo base (null mientras el perfil esté incompleto). Lo consumen los demás servicios. */
  async resumen(usuarioId: string) {
    const perfil = await this.perfil(usuarioId);
    const ultima = await this.mediciones.findOne({ where: { usuarioId }, order: { fecha: 'DESC' } });
    const pesoActual = ultima?.pesoKg ?? perfil.pesoInicialKg;
    if (!perfil.completo || pesoActual === null) return { perfil, pesoActual, calculo: null };
    const fisico: PerfilFisico = {
      edad: perfil.edad!,
      sexo: perfil.sexo!,
      alturaCm: perfil.alturaCm!,
      pesoKg: pesoActual,
      nivelActividad: perfil.nivelActividad!,
      objetivo: perfil.objetivo!,
      condiciones: perfil.condiciones,
    };
    return { perfil, pesoActual, calculo: resumen(fisico) };
  }

  async calculo(usuarioId: string) {
    const { calculo } = await this.resumen(usuarioId);
    if (!calculo) throw new ConflictException('Completa tu perfil (edad, sexo, altura, peso, actividad y objetivo) para calcular tu plan.');
    return calculo;
  }

  // ---------- Mediciones ----------

  listarMediciones(usuarioId: string) {
    return this.mediciones.find({ where: { usuarioId }, order: { fecha: 'ASC' }, select: { id: true, fecha: true, pesoKg: true } });
  }

  /** Un registro por día: si ya hay uno de esa fecha, se reemplaza. Las metas se recalculan con el nuevo peso. */
  async registrarPeso(usuarioId: string, pesoKg: number, fecha = hoy()) {
    if (fecha > hoy()) throw new BadRequestException('La fecha no puede ser futura.');
    if (!(await this.perfiles.existsBy({ usuarioId }))) throw new ConflictException('Primero contesta tu perfil inicial.');
    await this.mediciones.upsert({ usuarioId, fecha, pesoKg }, ['usuarioId', 'fecha']);
    await this.sincronizarRecomendaciones(usuarioId);
    return { mediciones: await this.listarMediciones(usuarioId), ...(await this.resumen(usuarioId)) };
  }

  async borrarMedicion(usuarioId: string, id: string) {
    const r = await this.mediciones.delete({ id, usuarioId });
    if (!r.affected) throw new NotFoundException('No encontramos esa medición.');
    await this.sincronizarRecomendaciones(usuarioId);
  }

  // ---------- Recomendaciones ----------

  /** Las del profesionista van primero: tienen prioridad sobre las automáticas y las de Fati. */
  async listarRecomendaciones(usuarioId: string) {
    const lista = await this.recomendaciones.find({ where: { usuarioId, vigente: true }, order: { creadoEn: 'DESC' } });
    const prioridad = { profesionista: 0, reglas: 1, fati: 2 };
    return lista
      .sort((a, b) => prioridad[a.origen] - prioridad[b.origen])
      .map(({ id, origen, tipo, texto, creadoEn }) => ({ id, origen, tipo, texto, creadoEn }));
  }

  /** Mantiene al día la recomendación de consulta médica según el cálculo actual. */
  private async sincronizarRecomendaciones(usuarioId: string) {
    const { calculo } = await this.resumen(usuarioId);
    const filtro = { usuarioId, origen: 'reglas' as const, tipo: 'consulta_medica' };
    const existe = await this.recomendaciones.findOneBy(filtro);
    const vigente = calculo?.consultaMedica ?? false;
    if (existe) await this.recomendaciones.update(existe.id, { vigente });
    else if (vigente) await this.recomendaciones.insert({ ...filtro, texto: TEXTO_CONSULTA_MEDICA, vigente: true });
  }

  /** Borrado total de los datos de salud (mediciones, condiciones y recomendaciones caen en cascada). */
  async borrarTodo(usuarioId: string) {
    await this.perfiles.delete({ usuarioId });
  }
}
