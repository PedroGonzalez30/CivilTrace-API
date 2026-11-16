/**
 * @archivo clientePrisma.ts
 * @proyecto Civil Trace
 * @descripcion Crea el cliente de Prisma que usa toda la API para hablar con PostgreSQL.
 * @autor Pedro Ivan Gozanlez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { PrismaPg } from '@prisma/adapter-pg';

import { entorno } from '@/configuracion/entorno';
import { PrismaClient } from '@/generated/prisma/client';

// 4. Función principal
const adaptador = new PrismaPg({ connectionString: entorno.DATABASE_URL });

// Una sola instancia compartida: cada instancia abre su propio grupo de conexiones.
export const prisma = new PrismaClient({ adapter: adaptador });
