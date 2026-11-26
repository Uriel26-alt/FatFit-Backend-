import { Module } from '@nestjs/common';
import { baseDeDatos, ComunModule } from '@app/comun';
import { AdminController, ChatController, InternoController, PlanesController } from './fati.controller';
import { Configuracion, Mensaje, Plan, Suscripcion } from './fati.entity';
import { FatiService } from './fati.service';
import { ModeloService } from './modelo.service';
import { PlanesService } from './planes.service';

@Module({
  imports: [ComunModule, ...baseDeDatos('fati', [Plan, Suscripcion, Mensaje, Configuracion])],
  controllers: [ChatController, PlanesController, AdminController, InternoController],
  providers: [FatiService, PlanesService, ModeloService],
})
export class FatiModule {}
