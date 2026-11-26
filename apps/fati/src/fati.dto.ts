import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { PLANES } from './fati.entity';
import type { PlanId } from './fati.entity';

export class EnviarMensajeDto {
  /** @example ¿Qué es el déficit calórico y por qué mi meta es esa? */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(1, 1000)
  texto: string;
}

export class CambiarPlanDto {
  @IsIn(PLANES)
  planId: PlanId;
}

/** Lo que el administrador puede ajustar de un plan sin tocar el código. */
export class ActualizarPlanDto {
  /** Peticiones a Fati por mes. @example 40 */
  @IsOptional() @IsInt() @Min(0) @Max(100000)
  cuotaFati?: number;

  /** Precio mensual; null = gratis. @example 99 */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000)
  precioMensual?: number | null;

  @IsOptional() @IsString() @Length(3, 200)
  resumen?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true })
  beneficios?: string[];
}

export class ActualizarConfiguracionDto {
  /** Cualquier valor JSON (número, texto, objeto…). @example 15 */
  @IsDefined()
  valor: unknown;
}
