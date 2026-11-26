import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '@app/comun';
import type { Condicion, NivelActividad, Objetivo, Sexo } from './motor/calculos';

export type Lugar = 'casa' | 'casaEquipo' | 'gimnasio' | 'parque';
export const LUGARES: Lugar[] = ['casa', 'casaEquipo', 'gimnasio', 'parque'];

@Entity('perfiles_salud')
export class PerfilSalud {
  @PrimaryColumn('uuid') usuarioId: string;
  @Column('smallint', { nullable: true }) edad: number | null;
  @Column('text', { nullable: true }) sexo: Sexo | null;
  @Column('numeric', { nullable: true, transformer: numerico }) alturaCm: number | null;
  @Column('numeric', { nullable: true, transformer: numerico }) pesoInicialKg: number | null;
  @Column('text', { nullable: true }) nivelActividad: NivelActividad | null;
  @Column('text', { nullable: true }) objetivo: Objetivo | null;
  @Column('text') lugar: Lugar;
  @Column('smallint') minutos: number;
  @Column('text') condicionOtra: string;
  @Column('text', { array: true }) alimentos: string[];
  @Column('text') alimentoOtro: string;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) actualizadoEn: Date;
}

@Entity('condiciones_salud')
export class CondicionSalud {
  @PrimaryColumn('uuid') usuarioId: string;
  @PrimaryColumn('text') condicion: Condicion;
}

@Entity('mediciones')
export class Medicion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('date') fecha: string;
  @Column('numeric', { transformer: numerico }) pesoKg: number;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

export type OrigenRecomendacion = 'reglas' | 'fati' | 'profesionista';

@Entity('recomendaciones')
export class Recomendacion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') origen: OrigenRecomendacion;
  @Column('text') tipo: string;
  @Column('text') texto: string;
  @Column('boolean') vigente: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}
