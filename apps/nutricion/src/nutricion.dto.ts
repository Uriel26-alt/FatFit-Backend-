import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { REGEX_FECHA } from '@app/comun';
import { TIEMPOS } from './nutricion.entity';
import type { TiempoComida } from './nutricion.entity';

export class RegistrarComidaDto {
  /** Id del alimento del catálogo (GET /alimentos). */
  @IsUUID()
  alimentoId: string;

  @IsIn(TIEMPOS)
  tiempo: TiempoComida;

  /** Número de porciones. @example 1.5 */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(50)
  cantidad?: number = 1;

  /** Día (AAAA-MM-DD). Por omisión, hoy. */
  @IsOptional() @Matches(REGEX_FECHA)
  fecha?: string;
}

export class CrearAlimentoDto {
  /** @example Chilaquiles verdes */
  @IsString() @Length(2, 100)
  nombre: string;

  @IsOptional() @IsString() @Length(1, 60)
  marca?: string;

  @IsOptional() @Matches(/^\d{8,14}$/, { message: 'El código de barras debe tener de 8 a 14 dígitos.' })
  codigoBarras?: string;

  /** @example antojitos */
  @IsOptional() @IsString() @Length(2, 40)
  categoria?: string = 'otros';

  /** @example 1 plato */
  @IsString() @Length(1, 40)
  porcion: string;

  /** Calorías por porción. @example 420 */
  @IsNumber() @Min(0) @Max(5000)
  kcal: number;

  /** Proteína por porción (g). */
  @IsNumber() @Min(0) @Max(500)
  p: number;

  /** Carbohidratos por porción (g). */
  @IsNumber() @Min(0) @Max(500)
  c: number;

  /** Grasa por porción (g). */
  @IsNumber() @Min(0) @Max(500)
  g: number;

  /** Alimento más ligero que se propone en el análisis. */
  @IsOptional() @IsUUID()
  sustitutoId?: string;
}

export class ActualizarAlimentoDto extends PartialType(CrearAlimentoDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
