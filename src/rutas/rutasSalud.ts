/**
 * @archivo rutasSalud.ts
 * @proyecto Civil Trace
 * @descripcion Ruta de prueba para comprobar que la API está viva.
 * @autor Pedro Ivan Gozanlez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

// 4. Función principal
/**
 * Registra la ruta GET /salud.
 *
 * @param app - Instancia de Fastify donde se registra la ruta.
 */
export async function rutasSalud(app: FastifyInstance): Promise<void> {
  app.get('/salud', async () => ({ estado: 'ok' }));
}
