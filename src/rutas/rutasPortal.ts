/**
 * @archivo rutasPortal.ts
 * @proyecto Civil Trace
 * @descripcion Rutas públicas /portal del portal web del cliente. No usan JWT: se autorizan con el
 *   token del enlace de la obra (X-Token-Portal) y tienen su propio límite de peticiones.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente, RF-67 Consultar entregas en el portal del cliente, RF-14 Registrar aceptación de
 *   entrega, RF-60 Firmar aceptación de entrega, RF-15 Registrar observaciones del cliente,
 *   RF-71 Descargar documentos de una entrega en el portal
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  LIMITE_CUERPO_FIRMA_BYTES,
  MAXIMO_CODIGOS_POR_MINUTO,
  MAXIMO_PETICIONES_PORTAL_POR_MINUTO,
} from '@/constantes/portal';
import {
  esquemaAceptarEntrega,
  esquemaObservacionesEntrega,
  esquemaParametrosEntregaPortal,
  esquemaParametrosFotoPortal,
} from '@/esquemas/esquemasPortal';
import { obtenerAccesoPortal, verificarTokenPortal } from '@/middleware/tokenPortal';
import {
  listarAvancesPortal,
  obtenerFotoPortal,
  obtenerObraPortal,
} from '@/servicios/servicioPortal';
import { obtenerActaPdf, obtenerReportePdf } from '@/servicios/servicioDocumentosEntrega';
import { listarEntregasPortal } from '@/servicios/servicioEntregas';
import {
  aceptarEntrega,
  obtenerDetalleEntrega,
  obtenerFirmaEntrega,
  pedirCodigoAceptacion,
  registrarObservaciones,
} from '@/servicios/servicioRespuestaCliente';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
/** Opciones comunes: token del enlace y límite propio por IP (research R-09). */
export const OPCIONES_RUTA_PORTAL = {
  preHandler: [verificarTokenPortal],
  config: { rateLimit: { max: MAXIMO_PETICIONES_PORTAL_POR_MINUTO, timeWindow: '1 minute' } },
};

const CODIGO_ACEPTADO = 202;
const TIPO_PDF = 'application/pdf';

// Por IP y entrega: frena a quien intente mandar muchos correos al cliente de una entrega.
const OPCIONES_CODIGO = {
  ...OPCIONES_RUTA_PORTAL,
  config: {
    rateLimit: {
      max: MAXIMO_CODIGOS_POR_MINUTO,
      timeWindow: '1 minute',
      keyGenerator: (peticion: FastifyRequest) => `${peticion.ip}:${peticion.url}`,
    },
  },
};

// La firma viaja en base64 dentro del JSON; la API acepta 100 KB por defecto.
const OPCIONES_FIRMA = { ...OPCIONES_RUTA_PORTAL, bodyLimit: LIMITE_CUERPO_FIRMA_BYTES };

// 4. Función principal
export async function rutasPortal(app: FastifyInstance): Promise<void> {
  app.get('/obra', OPCIONES_RUTA_PORTAL, async (peticion) =>
    obtenerObraPortal(obtenerAccesoPortal(peticion)),
  );

  app.get('/avances', OPCIONES_RUTA_PORTAL, async (peticion) =>
    listarAvancesPortal(obtenerAccesoPortal(peticion)),
  );

  app.get('/fotos/:idAvance', OPCIONES_RUTA_PORTAL, async (peticion, respuesta) => {
    const { idAvance } = validar(esquemaParametrosFotoPortal, peticion.params);
    const foto = await obtenerFotoPortal(obtenerAccesoPortal(peticion), idAvance);
    // Privado: la foto no debe quedar en cachés compartidas (constitución IV.4).
    return respuesta
      .header('Cache-Control', 'private, max-age=300')
      .type(foto.tipo)
      .send(foto.datos);
  });

  app.get('/entregas', OPCIONES_RUTA_PORTAL, async (peticion) =>
    listarEntregasPortal(obtenerAccesoPortal(peticion)),
  );

  app.get('/entregas/:idEntrega', OPCIONES_RUTA_PORTAL, async (peticion) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    return obtenerDetalleEntrega(obtenerAccesoPortal(peticion), idEntrega);
  });

  app.get('/entregas/:idEntrega/firma', OPCIONES_RUTA_PORTAL, async (peticion, respuesta) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const firma = await obtenerFirmaEntrega(obtenerAccesoPortal(peticion), idEntrega);
    return respuesta
      .header('Cache-Control', 'private, no-store')
      .type(firma.tipo)
      .send(firma.datos);
  });

  app.post('/entregas/:idEntrega/codigo', OPCIONES_CODIGO, async (peticion, respuesta) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const codigo = await pedirCodigoAceptacion(obtenerAccesoPortal(peticion), idEntrega);
    return respuesta.status(CODIGO_ACEPTADO).send(codigo);
  });

  app.post('/entregas/:idEntrega/aceptar', OPCIONES_FIRMA, async (peticion) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const datos = validar(esquemaAceptarEntrega, peticion.body);
    return aceptarEntrega(obtenerAccesoPortal(peticion), idEntrega, datos);
  });

  app.post('/entregas/:idEntrega/observaciones', OPCIONES_FIRMA, async (peticion) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const datos = validar(esquemaObservacionesEntrega, peticion.body);
    return registrarObservaciones(obtenerAccesoPortal(peticion), idEntrega, datos);
  });

  app.get('/entregas/:idEntrega/reporte.pdf', OPCIONES_RUTA_PORTAL, async (peticion, respuesta) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const pdf = await obtenerReportePdf(obtenerAccesoPortal(peticion), idEntrega);
    return respuesta.type(TIPO_PDF).send(pdf);
  });

  app.get('/entregas/:idEntrega/acta.pdf', OPCIONES_RUTA_PORTAL, async (peticion, respuesta) => {
    const { idEntrega } = validar(esquemaParametrosEntregaPortal, peticion.params);
    const pdf = await obtenerActaPdf(obtenerAccesoPortal(peticion), idEntrega);
    return respuesta.type(TIPO_PDF).send(pdf);
  });
}
