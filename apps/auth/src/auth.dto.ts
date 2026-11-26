import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import type { Rol } from '@app/comun';

const minusculas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Mínimo 8 caracteres, con letras y números. */
const CONTRASENA = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const MSG_CONTRASENA = 'Usa al menos 8 caracteres, con letras y números.';

export class RegistroDto {
  /** @example Ana Rodríguez */
  @Transform(recortar) @IsString() @Length(2, 80)
  nombre: string;

  /** @example ana.nueva@ejemplo.com */
  @Transform(minusculas) @IsEmail({}, { message: 'Escribe un correo válido.' })
  correo: string;

  /** @example Segura123 */
  @Matches(CONTRASENA, { message: MSG_CONTRASENA })
  contrasena: string;

  /** Aceptación de términos y aviso de privacidad. Debe ser true. */
  @Equals(true, { message: 'Necesitas aceptar los términos y el aviso de privacidad.' })
  aceptaTerminos: boolean;

  /** Consentimiento explícito para tratar datos de salud. Debe ser true. */
  @Equals(true, { message: 'Sin esta autorización no podemos calcular tu plan.' })
  aceptaDatosSalud: boolean;

  /** Los profesionistas se registran aquí y quedan pendientes de verificación (fase 4). */
  @IsOptional() @IsIn(['usuario', 'profesionista'])
  rol?: 'usuario' | 'profesionista' = 'usuario';
}

export class LoginDto {
  /** @example ana@fatfit.mx */
  @Transform(minusculas) @IsEmail()
  correo: string;

  /** @example Ana12345 */
  @IsString() @MinLength(1)
  contrasena: string;
}

export class RefrescarDto {
  @IsString() @MinLength(10)
  tokenRefresco: string;
}

export class RecuperarDto {
  /** @example ana@fatfit.mx */
  @Transform(minusculas) @IsEmail()
  correo: string;
}

export class RestablecerDto {
  @IsString() @MinLength(10)
  token: string;

  @Matches(CONTRASENA, { message: MSG_CONTRASENA })
  contrasena: string;
}

export class ActualizarCuentaDto {
  @Transform(recortar) @IsString() @Length(2, 80)
  nombre: string;
}

export class CambiarContrasenaDto {
  @IsString() @MinLength(1)
  actual: string;

  @Matches(CONTRASENA, { message: MSG_CONTRASENA })
  nueva: string;
}

export class EliminarCuentaDto {
  /** Contraseña actual, para confirmar el borrado total. */
  @IsString() @MinLength(1)
  contrasena: string;
}

export class AdministrarUsuarioDto {
  @IsOptional() @IsBoolean()
  activo?: boolean;

  @IsOptional() @IsIn(['usuario', 'profesionista', 'admin'])
  rol?: Rol;
}

export class UsuarioDto {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  creadoEn: Date;
}

export class ConsentimientoDto {
  version: string;
  fecha: Date;
}

export class SesionDto {
  usuario: UsuarioDto;
  /** JWT para la cabecera Authorization: Bearer … */
  tokenAcceso: string;
  /** Sirve para pedir otro tokenAcceso en POST /refrescar. Es de un solo uso. */
  tokenRefresco: string;
  consentimiento: ConsentimientoDto | null;
}

export class MensajeDto {
  mensaje: string;
  /** Solo fuera de producción: el token que normalmente llegaría por correo. */
  tokenDesarrollo?: string;
}
