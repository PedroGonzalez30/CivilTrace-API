/**
 * @archivo rutasHorario.ts
 * @proyecto Civil Trace
 * @descripcion Rutas del horario de la obra (pantalla SUP_HorarioObra). Solo validan, autorizan
 *   y llaman al servicio.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada (horario de referencia), D-06
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { esquemaGuardarHorario, esquemaParametrosObra } from '@/esquemas/esquemasAsistencia';
import { verificarToken } from '@/middleware/autenticacion';
import { guardarHorario, obtenerHorarioParaPantalla } from '@/servicios/servicioHorario';
import { validar } from '@/utilidades/validar';

// 4. Función principal
/**
 * Registra GET y PUT /obras/:obraId/horario (el prefijo /obras lo pone quien las registra).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasHorario(app: FastifyInstance): Promise<void> {
  app.get('/:obraId/horario', { preHandler: [verificarToken] }, async (peticion) => {
    const { obraId } = validar(esquemaParametrosObra, peticion.params);
    return obtenerHorarioParaPantalla(peticion.user, obraId);
  });

  app.put('/:obraId/horario', { preHandler: [verificarToken] }, async (peticion) => {
    const { obraId } = validar(esquemaParametrosObra, peticion.params);
    return guardarHorario(peticion.user, obraId, validar(esquemaGuardarHorario, peticion.body));
  });
}
