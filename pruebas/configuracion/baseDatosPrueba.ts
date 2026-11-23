/**
 * @archivo baseDatosPrueba.ts
 * @proyecto Civil Trace
 * @descripcion Ayudantes para dejar la base de prueba limpia entre archivos de prueba.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III (pruebas primero)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';

// 3. Constantes del módulo
// Tablas de Prisma que no son datos de negocio y no se deben vaciar.
const TABLAS_EXCLUIDAS = new Set(['_prisma_migrations']);

// 4. Funciones
/**
 * Vacía todas las tablas de negocio (TRUNCATE en cascada). Solo se usa contra la base de prueba.
 */
export async function limpiarTablas(): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const nombres = tablas
    .map((tabla) => tabla.tablename)
    .filter((nombre) => !TABLAS_EXCLUIDAS.has(nombre))
    .map((nombre) => `"public"."${nombre}"`);

  if (nombres.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${nombres.join(', ')} CASCADE`);
  }
}
