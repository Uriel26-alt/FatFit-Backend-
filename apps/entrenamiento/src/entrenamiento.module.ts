import { Module } from '@nestjs/common';
import { baseDeDatos, ComunModule } from '@app/comun';
import { EjerciciosController, InternoController, RutinaController } from './entrenamiento.controller';
import { Ejercicio, Rutina, RutinaEjercicio, Sesion } from './entrenamiento.entity';
import { EntrenamientoService } from './entrenamiento.service';

@Module({
  imports: [ComunModule, ...baseDeDatos('entrenamiento', [Ejercicio, Rutina, RutinaEjercicio, Sesion])],
  controllers: [RutinaController, EjerciciosController, InternoController],
  providers: [EntrenamientoService],
})
export class EntrenamientoModule {}
