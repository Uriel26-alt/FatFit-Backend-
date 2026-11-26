import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numerico } from '@app/comun';

export type PlanId = 'basico' | 'fatiMax' | 'pro';
export const PLANES: PlanId[] = ['basico', 'fatiMax', 'pro'];

@Entity('planes')
export class Plan {
  @PrimaryColumn('text') id: PlanId;
  @Column('text') nombre: string;
  @Column('numeric', { nullable: true, transformer: numerico }) precioMensual: number | null;
  @Column('text') moneda: string;
  @Column('integer') cuotaFati: number;
  @Column('text') resumen: string;
  @Column('text', { array: true }) beneficios: string[];
  @Column('boolean') incluyeProfesionista: boolean;
  @Column('smallint') orden: number;
  @UpdateDateColumn({ type: 'timestamptz' }) actualizadoEn: Date;
}

@Entity('suscripciones')
export class Suscripcion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') planId: PlanId;
  @Column('text') estado: 'activa' | 'terminada';
  @Column('text') proveedor: 'simulado' | 'stripe' | 'revenuecat';
  @Column('text', { nullable: true }) referencia: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) inicio: Date;
  @Column('timestamptz', { nullable: true }) fin: Date | null;
}

@Entity('mensajes')
export class Mensaje {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') de: 'usuario' | 'fati';
  @Column('text') texto: string;
  @Column('boolean') basadoEnCalculos: boolean;
  @Column('text') origen: 'usuario' | 'llm' | 'reglas' | 'sistema';
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

@Entity('configuracion')
export class Configuracion {
  @PrimaryColumn('text') clave: string;
  @Column('jsonb') valor: unknown;
  @Column('text') descripcion: string;
  @UpdateDateColumn({ type: 'timestamptz' }) actualizadoEn: Date;
}
