import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numerico } from '@app/comun';

export type TiempoComida = 'desayuno' | 'comida' | 'cena' | 'colacion';
export const TIEMPOS: TiempoComida[] = ['desayuno', 'comida', 'cena', 'colacion'];
export type OrigenAlimento = 'local' | 'openfoodfacts' | 'usda';

const num = { transformer: numerico };

@Entity('alimentos')
export class Alimento {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') nombre: string;
  @Column('text', { nullable: true }) marca: string | null;
  @Column('text', { nullable: true }) codigoBarras: string | null;
  @Column('text') origen: OrigenAlimento;
  @Column('text') categoria: string;
  @Column('text') porcion: string;
  @Column('numeric', num) kcal: number;
  @Column('numeric', num) proteinaG: number;
  @Column('numeric', num) carbosG: number;
  @Column('numeric', num) grasaG: number;
  @Column('uuid', { nullable: true }) sustitutoId: string | null;
  @Column('boolean') activo: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

@Entity('registros_comida')
export class RegistroComida {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') usuarioId: string;
  @Column('date') fecha: string;
  @Column('text') tiempo: TiempoComida;
  @Column('uuid', { nullable: true }) alimentoId: string | null;
  @Column('numeric', num) cantidad: number;
  @Column('text') nombre: string;
  @Column('text') porcion: string;
  @Column('numeric', num) kcal: number;
  @Column('numeric', num) proteinaG: number;
  @Column('numeric', num) carbosG: number;
  @Column('numeric', num) grasaG: number;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}
