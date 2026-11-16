/**
 * @archivo autenticacion.ts
 * @proyecto Civil Trace
 * @descripcion Middleware que verifica el token de acceso y el rol del usuario.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyRequest } from 'fastify';

import type { Rol } from '@/generated/prisma/enums';
import { ErrorHttp } from '@/utilidades/errores';

// 3. Constantes del módulo
const CODIGO_NO_AUTORIZADO = 401;
const CODIGO_PROHIBIDO = 403;

// 4. Funciones
/**
 * Exige un token de acceso válido en la cabecera Authorization: Bearer <token>.
 * Si es válido, deja los datos del token en peticion.user (id, rol y empresaId).
 *
 * @param peticion - Petición entrante.
 * @throws ErrorHttp 401 si falta el token o no es válido.
 */
export async function verificarToken(peticion: FastifyRequest): Promise<void> {
  try {
    await peticion.jwtVerify();
  } catch {
    throw new ErrorHttp(CODIGO_NO_AUTORIZADO, 'Sesión no válida o expirada');
  }
}

/**
 * Crea un middleware que solo deja pasar a los roles indicados. Va después de verificarToken.
 *
 * @param rolesPermitidos - Roles que pueden usar la ruta.
 * @returns Middleware para usar en preHandler.
 */
export function exigirRol(...rolesPermitidos: Rol[]) {
  return async (peticion: FastifyRequest): Promise<void> => {
    if (!rolesPermitidos.includes(peticion.user.rol)) {
      throw new ErrorHttp(CODIGO_PROHIBIDO, 'No tienes permiso para realizar esta acción');
    }
  };
}
