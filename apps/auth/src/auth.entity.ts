import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Rol } from '@app/comun';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') nombre: string;
  @Column('text') correo: string;
  @Column('text') contrasenaHash: string;
  @Column('text') rol: Rol;
  @Column('boolean') activo: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) actualizadoEn: Date;
}

export type TipoConsentimiento = 'terminos' | 'datos_salud';

@Entity('consentimientos')
export class Consentimiento {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') tipo: TipoConsentimiento;
  @Column('text') version: string;
  @CreateDateColumn({ type: 'timestamptz' }) aceptadoEn: Date;
}

export type TipoToken = 'refresco' | 'recuperacion';

@Entity('tokens')
export class Token {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('text') tipo: TipoToken;
  @Column('text') tokenHash: string;
  @Column('timestamptz') expiraEn: Date;
  @Column('timestamptz', { nullable: true }) usadoEn: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}
