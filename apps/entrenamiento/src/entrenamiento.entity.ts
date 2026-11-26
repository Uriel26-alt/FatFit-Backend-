import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Equipo, Parametros, TipoEjercicio } from './motor/rutinas';

@Entity('ejercicios')
export class Ejercicio {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') nombre: string;
  @Column('text') tipo: TipoEjercicio;
  @Column('text') grupoMuscular: string;
  @Column('smallint') nivel: number;
  @Column('text') equipo: Equipo;
  @Column('text') impacto: 'bajo' | 'alto';
  @Column('boolean') alAireLibre: boolean;
  @Column('text', { array: true }) contraindicaciones: string[];
  @Column('smallint') minutos: number;
  @Column('text') dosis: string;
  @Column('text') icono: string;
  @Column('boolean') activo: boolean;
}

@Entity('rutinas')
export class Rutina {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') nombre: string;
  @Column('smallint') minutos: number;
  @Column('text') equipo: string;
  @Column('text') nota: string;
  @Column('smallint') sesionesSemana: number;
  @Column('jsonb') parametros: Parametros;
  @Column('boolean') activa: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

@Entity('rutina_ejercicios')
export class RutinaEjercicio {
  @PrimaryColumn('uuid') rutinaId: string;
  @PrimaryColumn('smallint') diaSemana: number;
  @PrimaryColumn('smallint') orden: number;
  @Column('uuid') ejercicioId: string;
  @Column('text') dosis: string;
}

@Entity('sesiones_completadas')
export class Sesion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('uuid', { nullable: true }) rutinaId: string | null;
  @Column('date') fecha: string;
  @Column('uuid', { array: true }) ejerciciosCompletados: string[];
  @Column('boolean') completada: boolean;
  @UpdateDateColumn({ type: 'timestamptz' }) actualizadoEn: Date;
}
