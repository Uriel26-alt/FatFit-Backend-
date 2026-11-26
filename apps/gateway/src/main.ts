import { Controller, Get, Logger, Module, NotFoundException, Param } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ApiExcludeController, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { NOMBRES_SERVICIOS, NombreServicio, opcionesCors, puertoGateway, SERVICIOS, urlServicio } from '@app/comun';

/**
 * API Gateway: única puerta de entrada para el front.
 *   /api/<servicio>/...  → se reenvía al microservicio
 *   /docs                → Swagger con todos los servicios (selector arriba a la derecha)
 * No valida tokens: cada microservicio lo hace con el secreto compartido.
 */
@ApiExcludeController()
@Controller()
class GatewayController {
  @Get()
  inicio() {
    return { nombre: 'FatFit API', docs: '/docs', servicios: NOMBRES_SERVICIOS.map((s) => `/api/${s}`) };
  }

  /** Estado de cada microservicio. */
  @Get('estado')
  async estado() {
    const pares = await Promise.all(
      NOMBRES_SERVICIOS.map(async (s) => {
        try {
          const r = await fetch(`${urlServicio(s)}/estado`, { signal: AbortSignal.timeout(2000) });
          return [s, r.ok ? 'ok' : 'error'] as const;
        } catch {
          return [s, 'caído'] as const;
        }
      }),
    );
    return { gateway: 'ok', ...Object.fromEntries(pares) };
  }

  /** OpenAPI de un servicio, con las rutas apuntando al gateway. */
  @Get('especificaciones/:servicio')
  async especificacion(@Param('servicio') servicio: string) {
    if (!NOMBRES_SERVICIOS.includes(servicio as NombreServicio)) throw new NotFoundException();
    const r = await fetch(`${urlServicio(servicio as NombreServicio)}/docs-json`).catch(() => null);
    if (!r?.ok) throw new NotFoundException(`El servicio ${servicio} no está disponible.`);
    return { ...(await r.json()), servers: [{ url: `/api/${servicio}`, description: 'Gateway' }] };
  }
}

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true })], controllers: [GatewayController] })
class GatewayModule {}

async function bootstrap() {
  // Sin bodyParser: el cuerpo debe llegar intacto al microservicio.
  const app = await NestFactory.create(GatewayModule, { bodyParser: false });
  app.enableCors(opcionesCors());

  for (const s of NOMBRES_SERVICIOS) {
    app.use(
      `/api/${s}`,
      createProxyMiddleware({
        target: urlServicio(s),
        changeOrigin: true,
        on: {
          error: (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'content-type': 'application/json' });
              res.end(JSON.stringify({ statusCode: 503, message: `El servicio de ${s} no está disponible.` }));
            }
          },
        },
      }),
    );
  }

  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('FatFit API').setVersion('1.0').build());
  SwaggerModule.setup('docs', app, doc, {
    explorer: true,
    customSiteTitle: 'FatFit API',
    swaggerOptions: {
      persistAuthorization: true,
      urls: NOMBRES_SERVICIOS.map((s) => ({ name: SERVICIOS[s].titulo, url: `/especificaciones/${s}` })),
    },
  });

  await app.listen(puertoGateway());
  new Logger('Gateway').log(`http://localhost:${puertoGateway()}/docs`);
}
bootstrap();
