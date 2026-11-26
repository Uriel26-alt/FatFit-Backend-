// Arranca los seis microservicios compilados en un solo contenedor o máquina.
// Si uno se cae, se detienen todos para que la plataforma reinicie el conjunto.
const { spawn } = require('node:child_process');
const path = require('node:path');

const SERVICIOS = ['auth', 'salud', 'entrenamiento', 'nutricion', 'fati', 'gateway'];
const hijos = SERVICIOS.map((nombre) => {
  const hijo = spawn(process.execPath, [path.join(__dirname, '..', 'dist', 'apps', nombre, 'main.js')], { stdio: 'inherit' });
  hijo.on('exit', (codigo) => {
    console.error(`[${nombre}] terminó con código ${codigo}; deteniendo los demás.`);
    detener(codigo || 1);
  });
  return hijo;
});

let saliendo = false;
function detener(codigo) {
  if (saliendo) return;
  saliendo = true;
  for (const h of hijos) h.kill('SIGTERM');
  setTimeout(() => process.exit(codigo), 3000);
}
process.on('SIGTERM', () => detener(0));
process.on('SIGINT', () => detener(0));
