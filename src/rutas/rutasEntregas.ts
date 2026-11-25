/**
 * @archivo rutasEntregas.ts
 * @proyecto Civil Trace
 * @descripcion Rutas de la app para el portal del cliente: reenviar el enlace de la obra y, más
 *   adelante, enviar entregas y generar actas.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { esquemaParametrosObraEnlace } from '@/esquemas/esquemasPortal';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { reenviarEnlacePortal } from '@/servicios/servicioEnlacePortal';
import { validar } from '@/utilidades/validar';

// 4. Función principal
export async function rutasEntregas(app: FastifyInstance): Promise<void> {
  app.post(
    '/:idObra/enlace-portal/reenviar',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => {
      const { idObra } = validar(esquemaParametrosObraEnlace, peticion.params);
      return { enlacePortal: await reenviarEnlacePortal(peticion.user.empresaId, idObra) };
    },
  );
}
