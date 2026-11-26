import { Module } from '@nestjs/common';
import { baseDeDatos, ComunModule } from '@app/comun';
import { AuthController, UsuariosController } from './auth.controller';
import { AuthService } from './auth.service';
import { Consentimiento, Token, Usuario } from './auth.entity';

@Module({
  imports: [ComunModule, ...baseDeDatos('auth', [Usuario, Consentimiento, Token])],
  controllers: [AuthController, UsuariosController],
  providers: [AuthService],
})
export class AuthModule {}
