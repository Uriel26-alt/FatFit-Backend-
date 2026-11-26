import { Logger, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NombreServicio, opcionesCors, puertoGateway, puertoServicio, SERVICIOS, urlPublica } from './servicios';

/** Arranca un microservicio con validación, CORS y su Swagger en /docs. */
export async function arrancar(modulo: Type<unknown>, servicio: NombreServicio) {
  const app = await NestFactory.create(modulo);
  app.enableCors(opcionesCors());
  // Rechaza campos desconocidos y convierte tipos (query strings → números, etc.).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  const puerto = puertoServicio(servicio);
  const { titulo, descripcion } = SERVICIOS[servicio];
  const documento = new DocumentBuilder()
    .setTitle(`FatFit · ${titulo}`)
    .setDescription(`${descripcion}\n\nInicia sesión en Auth (\`POST /login\`), copia el \`tokenAcceso\` y pégalo en **Authorize**.`)
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer');
  // Desplegado, el único acceso es el gateway; en desarrollo también se puede ir directo al puerto.
  const publica = urlPublica();
  if (publica) documento.addServer(`${publica}/api/${servicio}`, 'Gateway');
  else documento.addServer(`http://localhost:${puerto}`, 'Directo al servicio').addServer(`http://localhost:${puertoGateway()}/api/${servicio}`, 'A través del gateway');
  const config = documento.build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: `FatFit · ${titulo}`,
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(puerto);
  new Logger(titulo).log(`http://localhost:${puerto}/docs`);
}
