import { Module } from '@nestjs/common';
import { baseDeDatos, ComunModule } from '@app/comun';
import { AlimentosController, ComidasController, InternoController } from './nutricion.controller';
import { Alimento, RegistroComida } from './nutricion.entity';
import { NutricionService } from './nutricion.service';

@Module({
  imports: [ComunModule, ...baseDeDatos('nutricion', [Alimento, RegistroComida])],
  controllers: [ComidasController, AlimentosController, InternoController],
  providers: [NutricionService],
})
export class NutricionModule {}
