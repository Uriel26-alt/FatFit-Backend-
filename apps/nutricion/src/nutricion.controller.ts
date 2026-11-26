import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Interno, Roles, TokenActual, UsuarioActual } from '@app/comun';
import type { UsuarioToken } from '@app/comun';
import { ActualizarAlimentoDto, CrearAlimentoDto, RegistrarComidaDto } from './nutricion.dto';
import { NutricionService } from './nutricion.service';

const FECHA = { name: 'fecha', required: false, description: 'AAAA-MM-DD' };

@Controller()
export class ComidasController {
  constructor(private readonly svc: NutricionService) {}

  @ApiTags('Registro de comidas')
  @Get('comidas')
  @ApiOperation({ summary: 'Mis comidas de un día (hoy por omisión)', description: 'Agrupadas por tiempo de comida, con la suma de calorías y macronutrientes y lo que falta para la meta.' })
  @ApiQuery(FECHA)
  delDia(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Query('fecha') fecha?: string) {
    return this.svc.delDia(u.id, token, fecha);
  }

  @ApiTags('Registro de comidas')
  @Post('comidas')
  @ApiOperation({ summary: 'Registrar un alimento y su porción', description: 'Devuelve el día actualizado.' })
  registrar(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Body() dto: RegistrarComidaDto) {
    return this.svc.registrar(u.id, token, dto);
  }

  @ApiTags('Registro de comidas')
  @Delete('comidas/:id')
  @ApiOperation({ summary: 'Quitar un alimento registrado', description: 'Devuelve el día actualizado.' })
  quitar(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.quitar(u.id, token, id);
  }

  @ApiTags('Análisis')
  @Get('analisis')
  @ApiOperation({ summary: 'Análisis de alimentación de un día (ayer por omisión)', description: 'Compara lo consumido contra la meta, detecta el exceso, los alimentos que más aportan y propone un sustituto más ligero. Sin IA.' })
  @ApiQuery(FECHA)
  analisis(@UsuarioActual() u: UsuarioToken, @TokenActual() token: string, @Query('fecha') fecha?: string) {
    return this.svc.analisis(u.id, token, fecha);
  }

  @ApiTags('Análisis')
  @Get('dias')
  @ApiOperation({ summary: 'Calorías registradas por día en los últimos 30 días' })
  dias(@UsuarioActual() u: UsuarioToken) {
    return this.svc.diasRegistrados(u.id);
  }
}

@ApiTags('Catálogo de alimentos')
@Controller('alimentos')
export class AlimentosController {
  constructor(private readonly svc: NutricionService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar alimentos por nombre' })
  @ApiQuery({ name: 'buscar', required: false, example: 'tortilla' })
  @ApiQuery({ name: 'limite', required: false, example: 20 })
  buscar(@UsuarioActual() u: UsuarioToken, @Query('buscar') buscar?: string, @Query('limite') limite?: string) {
    return this.svc.buscar(buscar, Number(limite), u.rol === 'admin');
  }

  @Get('codigo/:codigo')
  @ApiOperation({ summary: 'Buscar por código de barras', description: 'Si no está en el catálogo propio se consulta Open Food Facts y se guarda. Ejemplo: 7501055300075.' })
  porCodigo(@Param('codigo') codigo: string) {
    return this.svc.porCodigo(codigo);
  }

  @Roles('admin')
  @Post()
  @ApiOperation({ summary: 'Agregar un alimento local (solo admin)' })
  crear(@Body() dto: CrearAlimentoDto) {
    return this.svc.crearAlimento(dto);
  }

  @Roles('admin')
  @Patch(':id')
  @ApiOperation({ summary: 'Editar, desactivar o asignar sustituto a un alimento (solo admin)' })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActualizarAlimentoDto) {
    return this.svc.actualizarAlimento(id, dto);
  }
}

@ApiExcludeController()
@Controller('interno')
export class InternoController {
  constructor(private readonly svc: NutricionService) {}

  @Interno()
  @Delete('usuarios/:id')
  @HttpCode(204)
  async borrar(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.borrarTodo(id);
  }
}
