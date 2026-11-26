/** Microservicios de FatFit y el puerto que usa cada uno si no se configura otro. */
export const SERVICIOS = {
  auth: { puerto: 3001, titulo: 'Auth', descripcion: 'Cuentas, roles, consentimiento y sesiones (JWT).' },
  salud: { puerto: 3002, titulo: 'Salud', descripcion: 'Perfil inicial, mediciones y cálculo base (motor de reglas).' },
  entrenamiento: { puerto: 3003, titulo: 'Entrenamiento', descripcion: 'Catálogo de ejercicios, rutina semanal y sesiones completadas.' },
  nutricion: { puerto: 3004, titulo: 'Nutrición', descripcion: 'Catálogo de alimentos, registro de comidas y análisis diario.' },
  fati: { puerto: 3005, titulo: 'Fati', descripcion: 'Asistente Fati (LLM), cuotas, planes y suscripciones.' },
} as const;

export type NombreServicio = keyof typeof SERVICIOS;
export const NOMBRES_SERVICIOS = Object.keys(SERVICIOS) as NombreServicio[];

/** Las plataformas de despliegue asignan el puerto público en PORT. */
export const puertoGateway = () => Number(process.env.PORT ?? process.env.PUERTO_GATEWAY ?? 3000);
/** URL pública del gateway cuando está desplegado (p. ej. https://fatfit.ejemplo.com). */
export const urlPublica = () => process.env.URL_PUBLICA?.replace(/\/+$/, '') || null;
/** CORS: lista separada por comas en ORIGENES_CORS; vacío = cualquier origen (desarrollo). */
export const opcionesCors = () => {
  const origenes = (process.env.ORIGENES_CORS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  return { origin: origenes.length ? origenes : true };
};
export const puertoServicio = (s: NombreServicio) => Number(process.env[`PUERTO_${s.toUpperCase()}`] ?? SERVICIOS[s].puerto);
/** URL interna de un servicio (URL_SALUD, URL_FATI… permiten moverlo a otra máquina). */
export const urlServicio = (s: NombreServicio) => process.env[`URL_${s.toUpperCase()}`] ?? `http://localhost:${puertoServicio(s)}`;
