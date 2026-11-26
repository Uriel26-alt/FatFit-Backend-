import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NombreServicio, urlServicio } from './servicios';

type Opciones = {
  /** JWT del usuario: el otro servicio aplica sus mismas reglas de acceso. */
  token?: string;
  /** Llamada entre servicios sin usuario (usa CLAVE_INTERNA). */
  interno?: boolean;
  metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  cuerpo?: unknown;
};

/** Llamadas HTTP entre microservicios. */
@Injectable()
export class ClienteServicios {
  async pedir<T>(servicio: NombreServicio, ruta: string, o: Opciones = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(urlServicio(servicio) + ruta, {
        method: o.metodo ?? 'GET',
        headers: {
          ...(o.cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
          ...(o.interno ? { 'x-clave-interna': process.env.CLAVE_INTERNA ?? '' } : {}),
        },
        body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException(`El servicio de ${servicio} no está disponible.`);
    }
    const texto = await res.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (res.ok) return datos as T;
    if (res.status >= 500) throw new ServiceUnavailableException(`El servicio de ${servicio} falló.`);
    // Los errores del usuario (400, 404, 409…) se devuelven tal cual.
    throw new HttpException(datos ?? res.statusText, res.status);
  }

  /** Igual que pedir(), pero devuelve null si el otro servicio responde con error del cliente. */
  async intentar<T>(servicio: NombreServicio, ruta: string, o: Opciones = {}): Promise<T | null> {
    try {
      return await this.pedir<T>(servicio, ruta, o);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() < 500) return null;
      throw e;
    }
  }
}
