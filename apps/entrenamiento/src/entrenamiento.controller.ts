import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Interno, Roles, TokenActual, UsuarioActual } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import { ActualizarEjercicioDto, CrearEjercicioDto, EQUIPOS, GRUPOS, TIPOS } from './entrenamiento.dto';
import { EntrenamientoService } from './entrenamiento.service';

@Controller()
export class RutinaController {
  constructor(private readonly svc: EntrenamientoService) {}

  @ApiTags('Rutina')
  @Get('rutina')
  @ApiOperation({ summary: 'Mi rutina semanal completa', description: 'Se arma sola la primera vez y se vuelve a armar cuando cambia el perfil. Solo usa ejercicios del catálogo compatibles con mi tiempo, equipo, nivel y condiciones de salud.' })
  semana(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string) {
    return this.svc.semana(u.id, token);
  }

  @ApiTags('Rutina')
  @Get('rutina/hoy')
  @ApiOperation({ summary: 'Mi sesión de hoy, ejercicios marcados y estado de la semana' })
  hoy(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string) {
    return this.svc.rutinaDeHoy(u.id, token);
  }

  @ApiTags('Rutina')
  @Post('rutina/generar')
  @ApiOperation({ summary: 'Armar una rutina nueva con mi perfil actual' })
  async generar(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string) {
    await this.svc.generar(u.id, token);
    return this.svc.semana(u.id, token);
  }

  @ApiTags('Rutina')
  @Post('rutina/hoy/ejercicios/:ejercicioId/alternar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar o desmarcar un ejercicio de hoy', description: 'Cuando están todos marcados, la sesión del día queda como completada.' })
  alternar(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Param('ejercicioId', ParseUUIDPipe) ejercicioId: string) {
    return this.svc.alternar(u.id, token, ejercicioId);
  }

  @ApiTags('Seguimiento')
  @Get('sesiones')
  @ApiOperation({ summary: 'Mi historial de sesiones' })
  historial(@UsuarioActual() u: UsuarioToken) {
    return this.svc.historial(u.id);
  }

  @ApiTags('Seguimiento')
  @Get('estadisticas')
  @ApiOperation({ summary: 'Racha y entrenos completados' })
  estadisticas(@UsuarioActual() u: UsuarioToken) {
    return this.svc.estadisticas(u.id);
  }
}

@ApiTags('Catálogo de ejercicios')
@Controller('ejercicios')
export class EjerciciosController {
  constructor(private readonly svc: EntrenamientoService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar el catálogo' })
  @ApiQuery({ name: 'tipo', required: false, enum: TIPOS })
  @ApiQuery({ name: 'equipo', required: false, enum: EQUIPOS })
  @ApiQuery({ name: 'grupo', required: false, enum: GRUPOS })
  listar(@UsuarioActual() u: UsuarioToken, @Query('tipo') tipo?: string, @Query('equipo') equipo?: string, @Query('grupo') grupo?: string) {
    return this.svc.listarEjercicios({ tipo, equipo, grupo }, u.rol === 'admin');
  }

  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'Agregar un ejercicio (solo admin)' })
  crear(@Body() dto: CrearEjercicioDto) {
    return this.svc.crearEjercicio(dto);
  }

  @Roles('admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Editar o desactivar un ejercicio (solo admin)', description: 'Los ejercicios no se borran porque las rutinas ya armadas los usan; se desactivan con `activo: false`.' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarEjercicioDto) {
    return this.svc.actualizarEjercicio(id, dto);
  }
}

@ApiExcludeController()
@Controller('interno')
export class InternoController {
  constructor(private readonly svc: EntrenamientoService) {}

  @Interno()
  @Delete('usuarios/:id')
  @HttpCode(204)
  async borrar(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.borrarTodo(id);
  }
}
