/**
 * @archivo entorno.ts
 * @proyecto Civil Trace
 * @descripcion Lee y valida las variables de entorno al arrancar la API.
 * @autor Pedro Ivan Gozanlez Valdez
 * @fecha 16/11/2026
 * @version 1.1.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-13 Enviar entrega al cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Variables del portal del cliente y del correo
 *   (feature 004)
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
const TAMANO_MAXIMO_POR_DEFECTO_MB = 5;
// AES-256 necesita una llave de exactamente 32 bytes.
const BYTES_CLAVE_CIFRADO = 32;
const URL_PORTAL_POR_DEFECTO = 'http://localhost:5173';

const esquemaEntorno = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // En Azure y en desarrollo con el telefono la API debe escuchar en todas las interfaces.
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(PUERTO_MINIMO).max(PUERTO_MAXIMO).default(PUERTO_POR_DEFECTO),
  DATABASE_URL: z.string().min(1),
  JWT_SECRETO: z.string().min(LONGITUD_MINIMA_SECRETO_JWT),
  // Opcionales: sin ellas la API arranca, pero la subida de imágenes responde 503.
  AZURE_STORAGE_CUENTA: z.string().min(1).optional(),
  AZURE_STORAGE_CONTENEDOR: z.string().min(1).optional(),
  TAMANO_MAX_EVIDENCIA_MB: z.coerce.number().int().positive().default(TAMANO_MAXIMO_POR_DEFECTO_MB),
  // Portal del cliente (feature 004). Sin la llave, las funciones del portal responden 503.
  URL_PORTAL: z.url().default(URL_PORTAL_POR_DEFECTO),
  CLAVE_CIFRADO_PORTAL: z
    .string()
    .refine((valor) => Buffer.from(valor, 'base64').length === BYTES_CLAVE_CIFRADO, {
      message: 'Debe ser una llave de 32 bytes en base64',
    })
    .optional(),
  // Correo con Azure Communication Services (T-03). Sin endpoint, el envío responde 503.
  AZURE_COMUNICACION_ENDPOINT: z.url().optional(),
  CORREO_REMITENTE: z.email().optional(),
  // Solo para desarrollo local: escribe los correos en el registro en lugar de enviarlos.
  CORREO_EN_CONSOLA: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
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
