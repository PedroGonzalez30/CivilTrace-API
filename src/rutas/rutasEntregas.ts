/**
 * @archivo rutasEntregas.ts
 * @proyecto Civil Trace
 * @descripcion Rutas de la app para el portal del cliente: reenviar el enlace de la obra, enviar
 *   entregas, consultarlas y descargar su reporte y su acta.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-13 Enviar entrega al cliente,
 *   RF-12 Generar reporte de avance de obra, RF-16 Generar acta de entrega-recepción
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { esquemaEnviarEntrega, esquemaParametrosEntrega } from '@/esquemas/esquemasEntregas';
import { esquemaParametrosObraEnlace } from '@/esquemas/esquemasPortal';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { obtenerActaPdf, obtenerReportePdf } from '@/servicios/servicioDocumentosEntrega';
import { reenviarEnlacePortal } from '@/servicios/servicioEnlacePortal';
import { enviarEntrega, listarEntregasObra } from '@/servicios/servicioEntregas';
import { exigirSupervisorODueno, obtenerObraDeEmpresa } from '@/utilidades/permisosObra';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;
const TIPO_PDF = 'application/pdf';

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

  app.post('/:idObra/entregas', { preHandler: [verificarToken] }, async (peticion, respuesta) => {
    const { idObra } = validar(esquemaParametrosObraEnlace, peticion.params);
    const rango = validar(esquemaEnviarEntrega, peticion.body);
    const entrega = await enviarEntrega(peticion.user, idObra, rango);
    return respuesta.status(CODIGO_CREADO).send(entrega);
  });

  app.get('/:idObra/entregas', { preHandler: [verificarToken] }, async (peticion) => {
    const { idObra } = validar(esquemaParametrosObraEnlace, peticion.params);
    return listarEntregasObra(peticion.user, idObra);
  });

  app.get(
    '/:idObra/entregas/:idEntrega/reporte.pdf',
    { preHandler: [verificarToken] },
    async (peticion, respuesta) => {
      const { idObra, idEntrega } = validar(esquemaParametrosEntrega, peticion.params);
      const obra = await obtenerObraDeEmpresa(idObra, peticion.user.empresaId);
      exigirSupervisorODueno(obra, peticion.user);
      const pdf = await obtenerReportePdf({ obraId: idObra, empresaId: obra.empresaId }, idEntrega);
      return respuesta.type(TIPO_PDF).send(pdf);
    },
  );

  // POST porque la primera vez crea el acta (RF-16 "cuando el dueño o el supervisor la solicita").
  app.post(
    '/:idObra/entregas/:idEntrega/acta',
    { preHandler: [verificarToken] },
    async (peticion, respuesta) => {
      const { idObra, idEntrega } = validar(esquemaParametrosEntrega, peticion.params);
      const obra = await obtenerObraDeEmpresa(idObra, peticion.user.empresaId);
      exigirSupervisorODueno(obra, peticion.user);
      const pdf = await obtenerActaPdf({ obraId: idObra, empresaId: obra.empresaId }, idEntrega);
      return respuesta.type(TIPO_PDF).send(pdf);
    },
  );
}
