/**
 * @archivo entorno.ts
 * @proyecto Civil Trace
 * @descripcion Lee y valida las variables de entorno al arrancar la API.
 * @autor Pedro Ivan Gozanlez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import 'dotenv/config';
import { z } from 'zod';

// 3. Constantes del módulo
const PUERTO_POR_DEFECTO = 3000;
const PUERTO_MINIMO = 1;
const PUERTO_MAXIMO = 65535;
// Un secreto corto se puede adivinar por fuerza bruta; por eso se exige una longitud mínima.
const LONGITUD_MINIMA_SECRETO_JWT = 32;

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // En Azure y en desarrollo con el teléfono la API debe escuchar en todas las interfaces.
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(PUERTO_MINIMO).max(PUERTO_MAXIMO).default(PUERTO_POR_DEFECTO),
  DATABASE_URL: z.string().min(1),
  JWT_SECRETO: z.string().min(LONGITUD_MINIMA_SECRETO_JWT),
});

// 4. Función principal
const resultado = esquemaEntorno.safeParse(process.env);

if (!resultado.success) {
  // Solo se muestran los nombres de las variables con problema, nunca sus valores.
  const variablesConError = resultado.error.issues.map((problema) => problema.path.join('.'));
  console.error(`Configuración inválida. Revisa estas variables: ${variablesConError.join(', ')}`);
  process.exit(1);
}

export const entorno = resultado.data;
