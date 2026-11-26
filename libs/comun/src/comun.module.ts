import { Controller, Get, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ApiExcludeController } from '@nestjs/swagger';
import { ClienteServicios } from './cliente-servicios';
import { AutenticacionGuard, Publico } from './seguridad';

@ApiExcludeController()
@Controller('estado')
class EstadoController {
  @Publico()
  @Get()
  estado() {
    return { ok: true, hora: new Date().toISOString() };
  }
}

/** Lo que comparten todos los microservicios: configuración (.env), JWT, guardia de acceso y cliente interno. */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRETO'),
        signOptions: { expiresIn: config.get('JWT_EXPIRA') ?? '1h' },
      }),
    }),
  ],
  controllers: [EstadoController],
  providers: [ClienteServicios, { provide: APP_GUARD, useClass: AutenticacionGuard }],
  exports: [ClienteServicios],
})
export class ComunModule {}
