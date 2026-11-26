import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefaultNamingStrategy, ValueTransformer } from 'typeorm';

const aSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

/** Las propiedades van en camelCase y las columnas en snake_case (pesoKg → peso_kg). */
class NombresSnake extends DefaultNamingStrategy {
  columnName(propiedad: string, personalizado: string | undefined): string {
    return personalizado ?? aSnake(propiedad);
  }
}

/** PostgreSQL devuelve los numeric como texto; esto los convierte a número. */
export const numerico: ValueTransformer = {
  to: (v) => v,
  from: (v) => (v === null || v === undefined ? v : Number(v)),
};

/**
 * Conexión de un microservicio a su esquema. Las tablas se crean con
 * db/01_esquema.sql (synchronize está apagado a propósito).
 */
export function baseDeDatos(esquema: string, entidades: Function[]) {
  return [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        schema: esquema,
        entities: entidades,
        synchronize: false,
        namingStrategy: new NombresSnake(),
      }),
    }),
    TypeOrmModule.forFeature(entidades),
  ];
}
