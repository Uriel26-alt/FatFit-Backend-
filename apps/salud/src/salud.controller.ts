import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Interno, UsuarioActual } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import { resumen } from './motor/calculos';
import { ActualizarPerfilDto, RegistrarPesoDto, SimularCalculoDto } from './salud.dto';
import { SaludService } from './salud.service';

@Controller()
export class SaludController {
  constructor(private readonly salud: SaludService) {}

  @ApiTags('Perfil')
  @Get('perfil')
  @ApiOperation({ summary: 'Mi perfil inicial', description: '`completo` indica si ya tiene todo lo que el motor de reglas necesita.' })
  perfil(@UsuarioActual() u: UsuarioToken) {
    return this.salud.perfil(u.id);
  }

  @ApiTags('Perfil')
  @Patch('perfil')
  @ApiOperation({ summary: 'Guardar respuestas del cuestionario', description: 'Solo cambia los campos enviados; se puede llamar en cada paso.' })
  actualizarPerfil(@UsuarioActual() u: UsuarioToken, @Body() dto: ActualizarPerfilDto) {
    return this.salud.actualizarPerfil(u.id, dto);
  }

  @ApiTags('Cálculo base')
  @Get('calculo')
  @ApiOperation({ summary: 'Mi cálculo base', description: 'IMC, gasto basal (Mifflin-St Jeor), gasto diario, meta de calorías y macros con mi peso más reciente. Sin IA. Responde 409 si el perfil está incompleto.' })
  calculo(@UsuarioActual() u: UsuarioToken) {
    return this.salud.calculo(u.id);
  }

  @ApiTags('Cálculo base')
  @Post('calculo/simular')
  @HttpCode(200)
  @ApiOperation({ summary: 'Probar el motor de reglas con datos libres (no guarda nada)' })
  simular(@Body() dto: SimularCalculoDto) {
    return resumen(dto);
  }

  @ApiTags('Cálculo base')
  @Get('resumen')
  @ApiOperation({ summary: 'Perfil, peso actual y cálculo en una sola llamada', description: '`calculo` es null mientras el perfil esté incompleto.' })
  resumen(@UsuarioActual() u: UsuarioToken) {
    return this.salud.resumen(u.id);
  }

  @ApiTags('Seguimiento')
  @Get('mediciones')
  @ApiOperation({ summary: 'Mi historial de peso, del más antiguo al más reciente' })
  mediciones(@UsuarioActual() u: UsuarioToken) {
    return this.salud.listarMediciones(u.id);
  }

  @ApiTags('Seguimiento')
  @Post('mediciones')
  @ApiOperation({ summary: 'Registrar mi peso', description: 'Devuelve el historial y el cálculo ya recalculado con el nuevo peso.' })
  registrarPeso(@UsuarioActual() u: UsuarioToken, @Body() dto: RegistrarPesoDto) {
    return this.salud.registrarPeso(u.id, dto.pesoKg, dto.fecha);
  }

  @ApiTags('Seguimiento')
  @Delete('mediciones/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar una medición' })
  async borrarMedicion(@UsuarioActual() u: UsuarioToken, @Param('id', ParseUUIDPipe) id: string) {
    await this.salud.borrarMedicion(u.id, id);
  }

  @ApiTags('Seguimiento')
  @Get('recomendaciones')
  @ApiOperation({ summary: 'Mis recomendaciones vigentes', description: 'Incluye la de consulta médica cuando el perfil declara embarazo, cardiopatía, diabetes o un IMC extremo.' })
  recomendaciones(@UsuarioActual() u: UsuarioToken) {
    return this.salud.listarRecomendaciones(u.id);
  }
}

@ApiExcludeController()
@Controller('interno')
export class InternoController {
  constructor(private readonly salud: SaludService) {}

  @Interno()
  @Delete('usuarios/:id')
  @HttpCode(204)
  async borrar(@Param('id', ParseUUIDPipe) id: string) {
    await this.salud.borrarTodo(id);
  }
}
