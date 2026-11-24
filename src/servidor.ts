/**
 * @archivo servidor.ts
 * @proyecto Civil Trace
 * @descripcion Punto de arranque de la API: abre el puerto y cierra todo ordenadamente.
 * @autor <TU_NOMBRE>
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { construirApp } from '@/app';
import { prisma } from '@/baseDatos/clientePrisma';
import { entorno } from '@/configuracion/entorno';

// 4. Función principal
async function iniciarServidor(): Promise<void> {
  const app = await construirApp();

  // Azure y Docker envían estas señales al detener la app; se cierra sin cortar peticiones.
  const cerrarOrdenadamente = async (): Promise<void> => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', cerrarOrdenadamente);
  process.on('SIGTERM', cerrarOrdenadamente);

  try {
    await app.listen({ port: entorno.PORT, host: entorno.HOST });
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

await iniciarServidor();
