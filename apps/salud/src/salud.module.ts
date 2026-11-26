import { Module } from '@nestjs/common';
import { baseDeDatos, ComunModule } from '@app/comun';
import { InternoController, SaludController } from './salud.controller';
import { CondicionSalud, Medicion, PerfilSalud, Recomendacion } from './salud.entity';
import { SaludService } from './salud.service';

@Module({
  imports: [ComunModule, ...baseDeDatos('salud', [PerfilSalud, CondicionSalud, Medicion, Recomendacion])],
  controllers: [SaludController, InternoController],
  providers: [SaludService],
})
export class SaludModule {}
