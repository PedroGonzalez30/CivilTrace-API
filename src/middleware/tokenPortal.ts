/**
 * @archivo tokenPortal.ts
 * @proyecto Civil Trace
 * @descripcion Autoriza las rutas públicas del portal del cliente con el token del enlace de la
 *   obra (encabezado X-Token-Portal) en lugar de JWT. Deja en la petición la obra y la empresa a
 *   las que da acceso.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente, RF-67 Consultar entregas en el portal del cliente, RNF-03 Control de acceso por rol
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import type { FastifyRequest } from 'fastify';

import { prisma } from '@/baseDatos/clientePrisma';
import { ENCABEZADO_TOKEN_PORTAL } from '@/constantes/portal';
import { ErrorHttp } from '@/utilidades/errores';
import { calcularHashToken } from '@/utilidades/tokens';

// 2. Tipos e interfaces
export interface AccesoPortal {
  obraId: string;
  empresaId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    accesoPortal?: AccesoPortal;
  }
}

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
// Un token de 32 bytes en base64url mide 43 caracteres; se acepta un margen sin aceptar basura.
const LONGITUD_MAXIMA_TOKEN = 128;
export const MENSAJE_ENLACE_INVALIDO = 'Este enlace no es válido. Pide uno nuevo a tu supervisor.';

// 4. Funciones
/**
 * Verifica el token del enlace. Un token inválido responde 404 (y no 401) para no confirmar que
 * existe algo detrás de la dirección.
 *
 * @param peticion - Petición de Fastify; recibe `accesoPortal`.
 * @throws ErrorHttp 404 si falta el token o no corresponde a ninguna obra.
 */
export async function verificarTokenPortal(peticion: FastifyRequest): Promise<void> {
  const token = peticion.headers[ENCABEZADO_TOKEN_PORTAL];
  if (typeof token !== 'string' || token.length === 0 || token.length > LONGITUD_MAXIMA_TOKEN) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_ENLACE_INVALIDO);
  }

  const enlace = await prisma.enlacePortal.findUnique({
    where: { tokenHash: calcularHashToken(token) },
    select: { obraId: true, empresaId: true },
  });
  if (!enlace) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_ENLACE_INVALIDO);
  }
  peticion.accesoPortal = enlace;
}

/**
 * @param peticion - Petición ya verificada con `verificarTokenPortal`.
 * @returns La obra y la empresa del enlace.
 * @throws ErrorHttp 404 si la ruta olvidó usar `verificarTokenPortal`.
 */
export function obtenerAccesoPortal(peticion: FastifyRequest): AccesoPortal {
  if (!peticion.accesoPortal) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_ENLACE_INVALIDO);
  }
  return peticion.accesoPortal;
}
