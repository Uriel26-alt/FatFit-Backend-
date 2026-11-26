import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClienteServicios } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import { Mensaje } from './fati.entity';
import { ModeloService, Turno } from './modelo.service';
import { AVISO_MEDICO, Contexto } from './motor/contexto';
import { cuotaAgotada, respuestaDeReglas, saludo } from './motor/plantillas';
import { validarRespuesta } from './motor/validacion';
import { PlanesService } from './planes.service';

type ResumenSalud = { perfil: { objetivo: Contexto['objetivo'] }; pesoActual: number | null; calculo: (NonNullable<Contexto['calculo']> & { bajoImpacto: boolean }) | null };
type Recomendacion = { origen: string; texto: string };
type RutinaHoy = { nombre: string; nota: string; esDiaDeEntreno: boolean; ejercicios: { nombre: string; dosis: string }[] };
type RutinaSemana = { dias: { ejercicios: { nombre: string }[] }[] };
type ComidasHoy = { totales: { kcal: number }; restantes: number | null; comidas: Record<string, { nombre: string; kcal: number }[]> };
type Analisis = NonNullable<Contexto['analisisDeAyer']>;

@Injectable()
export class FatiService {
  private readonly log = new Logger('Fati');

  constructor(
    @InjectRepository(Mensaje) private readonly mensajes: Repository<Mensaje>,
    private readonly planes: PlanesService,
    private readonly modelo: ModeloService,
    private readonly servicios: ClienteServicios,
  ) {}

  private aDto(m: Mensaje) {
    return { id: m.id, de: m.de, texto: m.texto, basadoEnCalculos: m.basadoEnCalculos, creadoEn: m.creadoEn };
  }

  async conversacion(u: UsuarioToken) {
    const lista = await this.mensajes.find({ where: { usuarioId: u.id }, order: { creadoEn: 'ASC' }, take: 200 });
    return {
      // Conversación nueva: Fati saluda (el saludo no se guarda ni gasta cuota).
      mensajes: lista.length ? lista.map((m) => this.aDto(m)) : [{ id: 'saludo', de: 'fati' as const, texto: saludo(u.nombre), basadoEnCalculos: false, creadoEn: new Date() }],
      cuota: await this.planes.cuota(u.id),
      aviso: AVISO_MEDICO,
      modo: this.modelo.disponible ? 'llm' : 'reglas',
    };
  }

  async borrarConversacion(usuarioId: string) {
    await this.mensajes.delete({ usuarioId });
  }

  /**
   * Una petición a Fati:
   *  1. se valida y aparta la cuota del plan en el servidor;
   *  2. se reúnen los resultados ya calculados por los otros servicios;
   *  3. el modelo redacta y su respuesta se valida antes de mostrarla;
   *  4. si el modelo no está, falla o no pasa la validación, responden las plantillas.
   */
  async enviar(u: UsuarioToken, token: string, texto: string) {
    const { ok, cuota } = await this.planes.consumir(u.id);
    if (!ok) {
      return {
        cuotaAgotada: true,
        mensajes: [
          { id: null, de: 'usuario' as const, texto, basadoEnCalculos: false, creadoEn: new Date() },
          { id: null, de: 'fati' as const, texto: cuotaAgotada(cuota.renuevaEl, cuota.plan), basadoEnCalculos: false, creadoEn: new Date() },
        ],
        cuota,
        aviso: AVISO_MEDICO,
      };
    }

    try {
      const ctx = await this.contexto(u, token);
      const n = await this.planes.valor<number>('fati.mensajes_contexto', 10);
      const previos = (await this.mensajes.find({ where: { usuarioId: u.id }, order: { creadoEn: 'DESC' }, take: Math.max(0, Math.min(n, 40)) })).reverse();
      const historial: Turno[] = previos.map((m) => ({ de: m.de, texto: m.texto }));
      while (historial.length && historial[0].de !== 'usuario') historial.shift(); // la conversación debe empezar con el usuario

      let respuesta = respuestaDeReglas(texto, ctx);
      let origen: Mensaje['origen'] = 'reglas';
      const delModelo = await this.modelo.responder(ctx, historial, texto);
      if (delModelo) {
        const v = validarRespuesta(delModelo, ctx);
        if (v.valida) {
          respuesta = { texto: delModelo, basadoEnCalculos: ctx.calculo !== null };
          origen = 'llm';
        } else this.log.warn(`Respuesta del modelo descartada (${v.motivo}); se usa la plantilla.`);
      }

      const [pregunta, contestacion] = await this.mensajes.save([
        this.mensajes.create({ usuarioId: u.id, de: 'usuario', texto, basadoEnCalculos: false, origen: 'usuario' }),
        this.mensajes.create({ usuarioId: u.id, de: 'fati', texto: respuesta.texto, basadoEnCalculos: respuesta.basadoEnCalculos, origen }),
      ]);
      return { cuotaAgotada: false, mensajes: [this.aDto(pregunta), this.aDto(contestacion)], cuota, aviso: AVISO_MEDICO };
    } catch (e) {
      // No se pudo atender: la petición no cuenta.
      await this.planes.devolver(u.id);
      throw e;
    }
  }

  /** Resultados ya calculados por salud, entrenamiento y nutrición. Es todo lo que el modelo recibe. */
  private async contexto(u: UsuarioToken, token: string): Promise<Contexto> {
    const o = { token };
    const [salud, recomendaciones, hoy, semana, comidas, analisis, catalogo] = await Promise.all([
      this.servicios.pedir<ResumenSalud>('salud', '/resumen', o),
      this.servicios.intentar<Recomendacion[]>('salud', '/recomendaciones', o),
      this.servicios.intentar<RutinaHoy>('entrenamiento', '/rutina/hoy', o),
      this.servicios.intentar<RutinaSemana>('entrenamiento', '/rutina', o),
      this.servicios.intentar<ComidasHoy>('nutricion', '/comidas', o),
      this.servicios.intentar<Analisis>('nutricion', '/analisis', o),
      this.servicios.intentar<{ nombre: string }[]>('entrenamiento', '/ejercicios', o),
    ]);
    const { bajoImpacto: _, ...calculo } = salud.calculo ?? ({} as NonNullable<ResumenSalud['calculo']>);
    return {
      nombre: u.nombre,
      objetivo: salud.perfil.objetivo,
      pesoActualKg: salud.pesoActual,
      calculo: salud.calculo ? calculo : null,
      rutina:
        hoy && semana
          ? {
              nombre: hoy.nombre,
              nota: hoy.nota,
              hoyEsDiaDeEntreno: hoy.esDiaDeEntreno,
              ejerciciosDeHoy: hoy.ejercicios.map(({ nombre, dosis }) => ({ nombre, dosis })),
              ejerciciosPermitidos: [...new Set(semana.dias.flatMap((d) => d.ejercicios.map((e) => e.nombre)))],
            }
          : null,
      comidasDeHoy: comidas
        ? { consumido: comidas.totales.kcal, restantes: comidas.restantes, alimentos: Object.values(comidas.comidas).flat().map(({ nombre, kcal }) => ({ nombre, kcal })) }
        : null,
      analisisDeAyer:
        analisis && analisis.estado !== 'sin_registros'
          ? { estado: analisis.estado, consumido: analisis.consumido, exceso: analisis.exceso, mayorAporte: analisis.mayorAporte, sustituto: analisis.sustituto }
          : null,
      recomendacionesProfesionista: (recomendaciones ?? []).filter((r) => r.origen === 'profesionista').map((r) => r.texto),
      catalogoEjercicios: (catalogo ?? []).map((e) => e.nombre),
    };
  }
}
