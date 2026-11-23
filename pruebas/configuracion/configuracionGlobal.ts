/**
 * @archivo configuracionGlobal.ts
 * @proyecto Civil Trace
 * @descripcion Se ejecuta una vez antes de todas las pruebas: aplica a la base de prueba las
 *   migraciones pendientes. No usa `migrate reset` (destructivo); cada archivo de prueba vacía las
 *   tablas con limpiarTablas() y la base de prueba vive en memoria (tmpfs) en docker-compose.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III (pruebas primero)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import 'dotenv/config';

import { execSync } from 'node:child_process';

// 4. Función principal
/**
 * Aplica a la base de prueba las migraciones de prisma/migrations que falten.
 *
 * @throws Error si falta DATABASE_URL_PRUEBAS o la base no responde.
 */
export default function prepararBasePruebas(): void {
  const urlBasePruebas = process.env['DATABASE_URL_PRUEBAS'];
  if (!urlBasePruebas) {
    throw new Error('Falta DATABASE_URL_PRUEBAS en .env (ver .env.example)');
  }

  execSync('npx prisma migrate deploy --config prisma7.config.ts', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: urlBasePruebas },
  });
}
