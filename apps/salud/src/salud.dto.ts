import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { REGEX_FECHA } from '@app/comun';
import { CONDICIONES, NIVELES, OBJETIVOS, SEXOS } from './motor/calculos';
import type { Condicion, NivelActividad, Objetivo, Sexo } from './motor/calculos';
import { LUGARES } from './salud.entity';
import type { Lugar } from './salud.entity';

/** Perfil inicial. Todos los campos son opcionales: el cuestionario se guarda por pasos. */
export class ActualizarPerfilDto {
  /** @example 34 */
  @IsOptional() @IsInt() @Min(14) @Max(100)
  edad?: number;

  @IsOptional() @IsIn(SEXOS)
  sexo?: Sexo;

  /** @example 165 */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(100) @Max(250)
  alturaCm?: number;

  /** Peso al registrarse. Crea la primera medición si aún no hay ninguna. @example 82 */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(30) @Max(300)
  pesoInicialKg?: number;

  @IsOptional() @IsIn(NIVELES)
  nivelActividad?: NivelActividad;

  @IsOptional() @IsIn(OBJETIVOS)
  objetivo?: Objetivo;

  /** Dónde entrena: define el equipo disponible. */
  @IsOptional() @IsIn(LUGARES)
  lugar?: Lugar;

  /** Minutos disponibles para ejercicio al día. @example 30 */
  @IsOptional() @IsInt() @Min(10) @Max(120)
  minutos?: number;

  /** Complicaciones de salud. Reemplaza la lista completa. @example ["rodilla"] */
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(CONDICIONES, { each: true })
  condiciones?: Condicion[];

  @IsOptional() @IsString() @MaxLength(200)
  condicionOtra?: string;

  /** Alimentos que más consume. @example ["Tortillas","Refresco"] */
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(60, { each: true })
  alimentos?: string[];

  @IsOptional() @IsString() @MaxLength(200)
  alimentoOtro?: string;
}

/** Datos para probar el motor de reglas sin guardar nada. */
export class SimularCalculoDto {
  /** @example 34 */
  @IsInt() @Min(14) @Max(100)
  edad: number;

  @IsIn(SEXOS)
  sexo: Sexo;

  /** @example 165 */
  @IsNumber() @Min(100) @Max(250)
  alturaCm: number;

  /** @example 79.6 */
  @IsNumber() @Min(30) @Max(300)
  pesoKg: number;

  @IsIn(NIVELES)
  nivelActividad: NivelActividad;

  @IsIn(OBJETIVOS)
  objetivo: Objetivo;

  /** @example ["rodilla"] */
  @IsArray() @IsIn(CONDICIONES, { each: true })
  condiciones: Condicion[] = [];
}

export class RegistrarPesoDto {
  /** @example 79.4 */
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(30) @Max(300)
  pesoKg: number;

  /** Día de la medición (AAAA-MM-DD). Por omisión, hoy. Solo hay una por día: si existe, se reemplaza. */
  @IsOptional() @Matches(REGEX_FECHA)
  fecha?: string;
}
