/**
 * @archivo rutasAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Rutas de asistencia: QR del trabajador, escaneo y registro (con y sin conexión),
 *   resumen del día, "Mi asistencia" y foto del trabajador. Solo validan, autorizan y llaman a
 *   los servicios.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, RF-56 Mostrar días con descuento, RF-58 Mostrar calendario de asistencia,
 *   RF-60 Registrar retardo o salida anticipada, RNF-07 Captura sin conexión (D-14)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import {
  esquemaConsultaCalendario,
  esquemaConsultaFecha,
  esquemaEditarDetalles,
  esquemaLoteEscaneos,
  esquemaParametrosCalendario,
  esquemaParametrosDia,
  esquemaParametrosObra,
  esquemaParametrosTrabajador,
  esquemaVistaPrevia,
} from '@/esquemas/esquemasAsistencia';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { obtenerCalendario } from '@/servicios/servicioCalendarioAsistencia';
import {
  listarObrasSupervisadas,
  obtenerFotoTrabajador,
  obtenerMiDia,
  obtenerPaqueteSinConexion,
  obtenerResumenDia,
} from '@/servicios/servicioConsultaAsistencia';
import { obtenerOCrearCredencial } from '@/servicios/servicioCredencialAsistencia';
import { editarDetalleDia, obtenerDetalleDia } from '@/servicios/servicioDetallesAsistencia';
import { obtenerVistaPrevia, procesarLoteEscaneos } from '@/servicios/servicioRegistroAsistencia';
import { ErrorHttp } from '@/utilidades/errores';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_PROHIBIDO = 403;

// 4. Función principal
/**
 * Registra las rutas de asistencia (sin prefijo: usan /asistencia y /obras/:obraId/asistencia).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasAsistencia(app: FastifyInstance): Promise<void> {
  const soloTrabajador = [verificarToken, exigirRol(Rol.TRABAJADOR)];
  const soloSupervisor = [verificarToken, exigirRol(Rol.SUPERVISOR)];

  app.get('/asistencia/mi-credencial', { preHandler: soloTrabajador }, async (peticion) => {
    // Un trabajador dado de baja ya no tiene empresa y no debe obtener QR.
    if (!peticion.user.empresaId) {
      throw new ErrorHttp(CODIGO_PROHIBIDO, 'No perteneces a ninguna empresa');
    }
    const { codigoQr, creadaEn } = await obtenerOCrearCredencial(
      peticion.user.sub,
      peticion.user.empresaId,
    );
    return { codigoQr, creadaEn };
  });

  app.get('/asistencia/mi-dia', { preHandler: soloTrabajador }, async (peticion) =>
    obtenerMiDia(peticion.user),
  );

  app.get('/asistencia/mis-obras', { preHandler: soloSupervisor }, async (peticion) => ({
    obras: await listarObrasSupervisadas(peticion.user),
  }));

  app.post('/asistencia/registros', { preHandler: soloSupervisor }, async (peticion) => {
    const { escaneos } = validar(esquemaLoteEscaneos, peticion.body);
    return { resultados: await procesarLoteEscaneos(peticion.user, escaneos) };
  });

  app.get(
    '/obras/:obraId/asistencia/paquete-sin-conexion',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { obraId } = validar(esquemaParametrosObra, peticion.params);
      return obtenerPaqueteSinConexion(peticion.user, obraId);
    },
  );

  app.post(
    '/obras/:obraId/asistencia/vista-previa',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { obraId } = validar(esquemaParametrosObra, peticion.params);
      const { codigoQr } = validar(esquemaVistaPrevia, peticion.body);
      return obtenerVistaPrevia(peticion.user, obraId, codigoQr);
    },
  );

  app.get('/obras/:obraId/asistencia', { preHandler: [verificarToken] }, async (peticion) => {
    const { obraId } = validar(esquemaParametrosObra, peticion.params);
    const { fecha } = validar(esquemaConsultaFecha, peticion.query);
    return obtenerResumenDia(peticion.user, obraId, fecha);
  });

  app.get(
    '/obras/:obraId/asistencia/trabajadores/:trabajadorId/foto',
    { preHandler: [verificarToken] },
    async (peticion, respuesta) => {
      const { obraId, trabajadorId } = validar(esquemaParametrosTrabajador, peticion.params);
      const { datos, tipo } = await obtenerFotoTrabajador(peticion.user, obraId, trabajadorId);
      return respuesta.header('Cache-Control', 'private, no-cache').type(tipo).send(datos);
    },
  );

  app.get(
    '/obras/:obraId/asistencia/trabajadores/:trabajadorId/dias/:fecha',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { obraId, trabajadorId, fecha } = validar(esquemaParametrosDia, peticion.params);
      return obtenerDetalleDia(peticion.user, obraId, trabajadorId, fecha);
    },
  );

  app.patch(
    '/obras/:obraId/asistencia/trabajadores/:trabajadorId/dias/:fecha',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { obraId, trabajadorId, fecha } = validar(esquemaParametrosDia, peticion.params);
      const cambios = validar(esquemaEditarDetalles, peticion.body ?? {});
      return editarDetalleDia(peticion.user, obraId, trabajadorId, fecha, cambios);
    },
  );

  app.get(
    '/asistencia/trabajadores/:trabajadorId/calendario',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { trabajadorId } = validar(esquemaParametrosCalendario, peticion.params);
      const { mes, obraId } = validar(esquemaConsultaCalendario, peticion.query);
      return obtenerCalendario(peticion.user, trabajadorId, mes, obraId);
    },
  );
}
