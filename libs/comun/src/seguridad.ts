import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export type Rol = 'usuario' | 'profesionista' | 'admin';
export const ROLES: Rol[] = ['usuario', 'profesionista', 'admin'];

/** Lo que viaja en el JWT y queda disponible en cada petición. */
export type UsuarioToken = { id: string; correo: string; nombre: string; rol: Rol };

const PUBLICO = 'publico';
const INTERNO = 'interno';
const ROLES_PERMITIDOS = 'roles';

/** Ruta sin autenticación. */
export const Publico = () => SetMetadata(PUBLICO, true);
/** Ruta que solo pueden llamar otros microservicios (cabecera x-clave-interna). */
export const Interno = () => SetMetadata(INTERNO, true);
/** Restringe la ruta a ciertos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_PERMITIDOS, roles);

/** Usuario autenticado de la petición. */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioToken => ctx.switchToHttp().getRequest().usuario);
/** JWT de la petición, para reenviarlo a otro microservicio. */
export const TokenActual = createParamDecorator((_: unknown, ctx: ExecutionContext): string => ctx.switchToHttp().getRequest().token);

/**
 * Guardia global: todas las rutas piden un JWT válido salvo las marcadas con
 * @Publico() o @Interno(). Cada servicio valida el token por su cuenta con el
 * secreto compartido, así que funciona igual detrás del gateway o directo.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const meta = <T>(clave: string) => this.reflector.getAllAndOverride<T>(clave, [ctx.getHandler(), ctx.getClass()]);
    if (meta<boolean>(PUBLICO)) return true;

    const req = ctx.switchToHttp().getRequest();
    if (meta<boolean>(INTERNO)) {
      const clave = process.env.CLAVE_INTERNA;
      if (clave && req.headers['x-clave-interna'] === clave) return true;
      throw new ForbiddenException('Ruta reservada para los microservicios.');
    }

    const [tipo, token] = String(req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token de acceso.');
    try {
      const p = this.jwt.verify(token);
      req.usuario = { id: p.sub, correo: p.correo, nombre: p.nombre, rol: p.rol } satisfies UsuarioToken;
      req.token = token;
    } catch {
      throw new UnauthorizedException('Token inválido o vencido.');
    }

    const roles = meta<Rol[]>(ROLES_PERMITIDOS);
    if (roles?.length && !roles.includes(req.usuario.rol)) throw new ForbiddenException('Tu rol no tiene acceso a esta función.');
    return true;
  }
}
