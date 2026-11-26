import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Interno, Publico, Roles, TokenActual, UsuarioActual } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import { ActualizarConfiguracionDto, ActualizarPlanDto, CambiarPlanDto, EnviarMensajeDto } from './fati.dto';
import { PLANES } from './fati.entity';
import { FatiService } from './fati.service';
import { PlanesService } from './planes.service';

@ApiTags('Chat con Fati')
@Controller()
export class ChatController {
  constructor(
    private readonly fati: FatiService,
    private readonly planes: PlanesService,
  ) {}

  @Get('mensajes')
  @ApiOperation({ summary: 'Mi conversación con Fati, mi cuota y el aviso médico' })
  conversacion(@UsuarioActual() u: UsuarioToken) {
    return this.fati.conversacion(u);
  }

  @Post('mensajes')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Preguntarle a Fati',
    description:
      'El servidor verifica la cuota del plan antes de llamar al modelo. Fati solo recibe resultados ya calculados y su respuesta se valida (cifras, ejercicios permitidos y tono) antes de devolverse. ' +
      'Si la cuota se agotó responde con `cuotaAgotada: true`, cuándo se renueva y la opción de subir de plan.',
  })
  enviar(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Body() dto: EnviarMensajeDto) {
    return this.fati.enviar(u, token, dto.texto);
  }

  @Delete('mensajes')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar mi conversación (no devuelve cuota)' })
  async borrar(@UsuarioActual() u: UsuarioToken) {
    await this.fati.borrarConversacion(u.id);
  }

  @Get('cuota')
  @ApiOperation({ summary: 'Peticiones a Fati usadas y disponibles este mes' })
  cuota(@UsuarioActual() u: UsuarioToken) {
    return this.planes.cuota(u.id);
  }
}

@ApiTags('Planes y suscripción')
@Controller()
export class PlanesController {
  constructor(private readonly planes: PlanesService) {}

  @Publico()
  @Get('planes')
  @ApiOperation({ summary: 'Planes disponibles (público)' })
  listar() {
    return this.planes.listar();
  }

  @Get('suscripcion')
  @ApiOperation({ summary: 'Mi plan actual y mi cuota' })
  suscripcion(@UsuarioActual() u: UsuarioToken) {
    return this.planes.suscripcion(u.id);
  }

  @Post('suscripcion')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambiar de plan', description: 'El cambio es inmediato y el pago está **simulado**: aún no hay cobro con Stripe ni RevenueCat.' })
  cambiar(@UsuarioActual() u: UsuarioToken, @Body() dto: CambiarPlanDto) {
    return this.planes.cambiar(u.id, dto.planId);
  }
}

@ApiTags('Administración')
@Roles('admin')
@Controller()
export class AdminController {
  constructor(private readonly planes: PlanesService) {}

  @Patch('planes/:id')
  @ApiParam({ name: 'id', enum: PLANES })
  @ApiOperation({ summary: 'Cambiar cuota, precio o textos de un plan (solo admin)', description: 'La nueva cuota aplica desde la siguiente petición, sin tocar el código.' })
  actualizarPlan(@Param('id') id: string, @Body() dto: ActualizarPlanDto) {
    return this.planes.actualizar(id, dto);
  }

  @Get('configuracion')
  @ApiOperation({ summary: 'Ver la configuración (solo admin)' })
  configuracion() {
    return this.planes.listarConfiguracion();
  }

  @Put('configuracion/:clave')
  @ApiOperation({ summary: 'Cambiar un valor de configuración (solo admin)' })
  guardar(@Param('clave') clave: string, @Body() dto: ActualizarConfiguracionDto) {
    return this.planes.guardarConfiguracion(clave, dto.valor);
  }

  @Get('metricas')
  @ApiOperation({ summary: 'Consumo de IA y suscripciones por plan, agregados y anónimos (solo admin)' })
  metricas() {
    return this.planes.metricas();
  }
}

@ApiExcludeController()
@Controller('interno')
export class InternoController {
  constructor(private readonly planes: PlanesService) {}

  @Interno()
  @Delete('usuarios/:id')
  @HttpCode(204)
  async borrar(@Param('id', ParseUUIDPipe) id: string) {
    await this.planes.borrarTodo(id);
  }
}
