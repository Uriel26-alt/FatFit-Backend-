import { PartialType } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { Equipo, TipoEjercicio } from './motor/rutinas';

export const TIPOS: TipoEjercicio[] = ['calentamiento', 'fuerza', 'cardio', 'estiramiento'];
export const EQUIPOS: Equipo[] = ['ninguno', 'basico', 'gimnasio'];
export const GRUPOS = ['piernas', 'gluteos', 'pecho', 'espalda', 'hombros', 'core', 'cuerpo_completo'];
const CONDICIONES = ['rodilla', 'lumbar', 'hipertension', 'diabetes', 'cardiopatia', 'embarazo'];

export class CrearEjercicioDto {
  /** @example Sentadilla con liga */
  @IsString() @Length(3, 80)
  nombre: string;

  @IsIn(TIPOS)
  tipo: TipoEjercicio;

  @IsIn(GRUPOS)
  grupoMuscular: string;

  /** 1 principiante · 2 intermedio · 3 avanzado */
  @IsInt() @Min(1) @Max(3)
  nivel: number;

  @IsIn(EQUIPOS)
  equipo: Equipo;

  @IsIn(['bajo', 'alto'])
  impacto: 'bajo' | 'alto';

  @IsOptional() @IsBoolean()
  alAireLibre?: boolean = false;

  /** Condiciones de salud que excluyen este ejercicio. @example ["rodilla"] */
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(CONDICIONES, { each: true })
  contraindicaciones?: string[] = [];

  /** Duración aproximada en minutos. */
  @IsOptional() @IsInt() @Min(1) @Max(60)
  minutos?: number = 5;

  /** @example 3 series × 12 */
  @IsString() @Length(2, 40)
  dosis: string;

  /** Ícono del front: caminar, entrenar o estirar. */
  @IsOptional() @IsIn(['caminar', 'entrenar', 'estirar'])
  icono?: string = 'entrenar';
}

export class ActualizarEjercicioDto extends PartialType(CrearEjercicioDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
