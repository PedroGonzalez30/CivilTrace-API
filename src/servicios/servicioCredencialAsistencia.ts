/**
 * @archivo servicioCredencialAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Credencial QR permanente del trabajador: crearla la primera vez, devolverla y
 *   resolver un código escaneado al trabajador que lo porta.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, D-17
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-01)
 */

// 1. Importaciones
import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@/baseDatos/clientePrisma';
import { BYTES_TOKEN_QR, PREFIJO_QR } from '@/constantes/asistencia';
import { Prisma } from '@/generated/prisma/client';

// 2. Tipos e interfaces
export interface CredencialVisible {
  codigoQr: string;
  creadaEn: string;
}

export interface PortadorQr {
  trabajadorId: string;
  empresaId: string | null;
}

// 3. Constantes del módulo
const CODIGO_PRISMA_UNICO = 'P2002';

// 4. Funciones
/**
 * Huella SHA-256 (hex) del token. Es lo único que se comparte con la app del supervisor.
 *
 * @param token - Token sin el prefijo del QR.
 * @returns La huella.
 */
export function calcularHuella(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Devuelve la credencial del trabajador y la crea si todavía no existe. Siempre es la misma.
 *
 * @param trabajadorId - Trabajador.
 * @param empresaId - Empresa del trabajador.
 * @returns El código que va en el QR y la fecha de creación.
 */
export async function obtenerOCrearCredencial(
  trabajadorId: string,
  empresaId: string,
): Promise<CredencialVisible & { tokenHash: string }> {
  const existente = await prisma.credencialAsistencia.findUnique({ where: { trabajadorId } });
  if (existente) {
    return formatear(existente);
  }

  const token = randomBytes(BYTES_TOKEN_QR).toString('base64url');
  try {
    const creada = await prisma.credencialAsistencia.create({
      data: { trabajadorId, empresaId, token, tokenHash: calcularHuella(token) },
    });
    return formatear(creada);
  } catch (error) {
    // Dos peticiones simultáneas del mismo trabajador: gana la primera y se devuelve esa.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === CODIGO_PRISMA_UNICO
    ) {
      return formatear(
        await prisma.credencialAsistencia.findUniqueOrThrow({ where: { trabajadorId } }),
      );
    }
    throw error;
  }
}

/**
 * Busca al trabajador dueño de un código QR escaneado.
 *
 * @param codigoQr - Texto leído del QR.
 * @returns El trabajador y su empresa actual, o null si el código no es válido.
 */
export async function resolverCodigoQr(codigoQr: string): Promise<PortadorQr | null> {
  if (!codigoQr.startsWith(PREFIJO_QR)) {
    return null;
  }
  const credencial = await prisma.credencialAsistencia.findUnique({
    where: { tokenHash: calcularHuella(codigoQr.slice(PREFIJO_QR.length)) },
    select: { trabajadorId: true, trabajador: { select: { empresaId: true } } },
  });
  if (!credencial) {
    return null;
  }
  return { trabajadorId: credencial.trabajadorId, empresaId: credencial.trabajador.empresaId };
}

function formatear(credencial: { token: string; tokenHash: string; creadaEn: Date }) {
  return {
    codigoQr: `${PREFIJO_QR}${credencial.token}`,
    creadaEn: credencial.creadaEn.toISOString(),
    tokenHash: credencial.tokenHash,
  };
}
