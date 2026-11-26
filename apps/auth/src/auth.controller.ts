import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Publico, Roles, UsuarioActual } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import {
  ActualizarCuentaDto,
  AdministrarUsuarioDto,
  CambiarContrasenaDto,
  EliminarCuentaDto,
  LoginDto,
  MensajeDto,
  RecuperarDto,
  RefrescarDto,
  RegistroDto,
  RestablecerDto,
  SesionDto,
  UsuarioDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Sesión')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('registro')
  @ApiOperation({ summary: 'Crear cuenta con consentimiento explícito (queda en el plan Básico)' })
  registro(@Body() dto: RegistroDto): Promise<SesionDto> {
    return this.auth.registrar(dto);
  }

  @Publico()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto): Promise<SesionDto> {
    return this.auth.login(dto);
  }

  @Publico()
  @Post('refrescar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambiar un token de refresco por una sesión nueva' })
  refrescar(@Body() dto: RefrescarDto): Promise<SesionDto> {
    return this.auth.refrescar(dto.tokenRefresco);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cerrar sesión (invalida los tokens de refresco)' })
  async logout(@UsuarioActual() u: UsuarioToken) {
    await this.auth.cerrarSesion(u.id);
  }

  @Publico()
  @Post('recuperar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pedir recuperación de contraseña', description: 'Responde igual exista o no el correo. Mientras no haya envío de correos, fuera de producción devuelve el token en `tokenDesarrollo`.' })
  async recuperar(@Body() dto: RecuperarDto): Promise<MensajeDto> {
    const token = await this.auth.pedirRecuperacion(dto.correo);
    return {
      mensaje: 'Si el correo está registrado, te enviamos instrucciones para restablecer tu contraseña.',
      ...(token && process.env.NODE_ENV !== 'production' ? { tokenDesarrollo: token } : {}),
    };
  }

  @Publico()
  @Post('restablecer')
  @HttpCode(200)
  @ApiOperation({ summary: 'Definir una contraseña nueva con el token de recuperación' })
  async restablecer(@Body() dto: RestablecerDto): Promise<MensajeDto> {
    await this.auth.restablecer(dto.token, dto.contrasena);
    return { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  @Get('yo')
  @ApiOperation({ summary: 'Mi cuenta y mi consentimiento vigente' })
  yo(@UsuarioActual() u: UsuarioToken) {
    return this.auth.yo(u.id);
  }

  @Patch('yo')
  @ApiOperation({ summary: 'Cambiar mi nombre' })
  actualizar(@UsuarioActual() u: UsuarioToken, @Body() dto: ActualizarCuentaDto): Promise<UsuarioDto> {
    return this.auth.actualizarNombre(u.id, dto.nombre);
  }

  @Post('yo/contrasena')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cambiar mi contraseña' })
  async contrasena(@UsuarioActual() u: UsuarioToken, @Body() dto: CambiarContrasenaDto) {
    await this.auth.cambiarContrasena(u.id, dto.actual, dto.nueva);
  }

  @Delete('yo')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar mi cuenta y todos mis datos', description: 'Borrado total e irreversible en todos los microservicios.' })
  async eliminar(@UsuarioActual() u: UsuarioToken, @Body() dto: EliminarCuentaDto) {
    await this.auth.eliminarCuenta(u.id, dto.contrasena);
  }
}

@ApiTags('Administración')
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'Listar cuentas (solo admin; sin datos de salud)' })
  @ApiQuery({ name: 'buscar', required: false })
  @ApiQuery({ name: 'rol', required: false, enum: ['usuario', 'profesionista', 'admin'] })
  listar(@Query('buscar') buscar?: string, @Query('rol') rol?: string): Promise<UsuarioDto[]> {
    return this.auth.listar(buscar, rol);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Activar/desactivar una cuenta o cambiar su rol (solo admin)' })
  administrar(@UsuarioActual() actor: UsuarioToken, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdministrarUsuarioDto): Promise<UsuarioDto> {
    return this.auth.administrar(actor, id, dto);
  }
}
