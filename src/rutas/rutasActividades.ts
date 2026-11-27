/**
 * @archivo rutasActividades.ts
 * @proyecto Civil Trace
 * @descripcion Rutas de actividades y avances de una obra (listar, consultar detalle, reporte,
 *              crear, cambiar estado, subir evidencia fotográfica y descargar foto).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.3.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Revisión de evidencias, tipo de avance y
 *   /actividades/mias; permisos por obra en el servicio (feature 003)
 *   25/11/2026 - Emilio Manuel Esquivel - Ubicación de la evidencia en cabeceras (feature 007,
 *   RF-08)
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { entorno } from '@/configuracion/entorno';
import {
  esquemaActualizarEstadoActividad,
  esquemaComentarioAvance,
  esquemaCrearActividad,
  esquemaParametrosActividad,
  esquemaParametrosAvance,
  esquemaParametrosObra,
  esquemaRevisionAvance,
  esquemaTipoAvance,
  esquemaUbicacionAvance,
} from '@/esquemas/esquemasActividad';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import {
  actualizarEstadoActividad,
  crearActividadObra,
  listarActividadesObra,
  listarMisActividades,
  obtenerDetalleActividad,
  obtenerFotoAvance,
  registrarAvanceActividad,
  revisarAvance,
} from '@/servicios/servicioActividades';
import { obtenerReporteObra } from '@/servicios/servicioReportes';
import { esTipoImagen } from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;
const CODIGO_PETICION_INVALIDA = 400;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const LIMITE_CUERPO_BYTES = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;
const CABECERA_COMENTARIO = 'x-comentario-avance';
const CABECERA_TIPO = 'x-tipo-avance';
const CABECERA_LATITUD = 'x-latitud';
const CABECERA_LONGITUD = 'x-longitud';
const CABECERA_PRECISION = 'x-precision-ubicacion';
const CABECERA_REFERENCIA = 'x-referencia-ubicacion';

// Las cabeceras con texto libre llegan codificadas con encodeURIComponent.
function leerCabecera(
  valor: string | string[] | undefined,
  codificada = false,
): string | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }
  if (!codificada) {
    return valor;
  }
  try {
    return decodeURIComponent(valor);
  } catch {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'La referencia de ubicación no es válida');
  }
}

const esquemaQueryReporte = z.object({
  fechaInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  fechaFin: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// 4. Función principal
export async function rutasActividades(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    /^image\/.+$/,
    { parseAs: 'buffer', bodyLimit: LIMITE_CUERPO_BYTES },
    (_peticion, cuerpo, terminar) => terminar(null, cuerpo),
  );

  app.get('/:idObra/reporte', { preHandler: [verificarToken] }, async (peticion) => {
    const { idObra } = validar(esquemaParametrosObra, peticion.params);
    const { fechaInicio, fechaFin } = validar(esquemaQueryReporte, peticion.query);
    return await obtenerReporteObra(peticion.user.empresaId, idObra, fechaInicio, fechaFin);
  });

  app.get('/:idObra/actividades', { preHandler: [verificarToken] }, async (peticion) => {
    const { idObra } = validar(esquemaParametrosObra, peticion.params);
    return { actividades: await listarActividadesObra(peticion.user, idObra) };
  });

  app.get(
    '/:idObra/actividades/:idActividad',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { idObra, idActividad } = validar(esquemaParametrosActividad, peticion.params);
      return {
        actividad: await obtenerDetalleActividad(peticion.user, idObra, idActividad),
      };
    },
  );

  app.post(
    '/:idObra/actividades',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO, Rol.SUPERVISOR)] },
    async (peticion, respuesta) => {
      const { idObra } = validar(esquemaParametrosObra, peticion.params);
      const datos = validar(esquemaCrearActividad, peticion.body);
      const actividad = await crearActividadObra(peticion.user, idObra, datos);
      return respuesta.status(CODIGO_CREADO).send({ actividad });
    },
  );

  app.patch(
    '/:idObra/actividades/:idActividad/estado',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO, Rol.SUPERVISOR)] },
    async (peticion) => {
      const { idObra, idActividad } = validar(esquemaParametrosActividad, peticion.params);
      const datos = validar(esquemaActualizarEstadoActividad, peticion.body);
      return {
        actividad: await actualizarEstadoActividad(peticion.user, idObra, idActividad, datos),
      };
    },
  );

  app.post(
    '/:idObra/actividades/:idActividad/avances',
    {
      preHandler: [verificarToken, exigirRol(Rol.DUENO, Rol.SUPERVISOR, Rol.TRABAJADOR)],
      bodyLimit: LIMITE_CUERPO_BYTES,
    },
    async (peticion, respuesta) => {
      const { idObra, idActividad } = validar(esquemaParametrosActividad, peticion.params);
      const cuerpo = peticion.body;
      const tipo = peticion.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0 || !esTipoImagen(tipo)) {
        throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Envía una imagen válida');
      }

      const rawComentario = peticion.headers[CABECERA_COMENTARIO];
      const comentarioDecodificado =
        typeof rawComentario === 'string' ? decodeURIComponent(rawComentario) : '';
      const { comentario } = validar(esquemaComentarioAvance, {
        comentario: comentarioDecodificado,
      });

      const tipoCabecera = peticion.headers[CABECERA_TIPO];
      const { tipo: tipoAvance } = validar(esquemaTipoAvance, {
        tipo: typeof tipoCabecera === 'string' ? tipoCabecera.trim().toUpperCase() : undefined,
      });

      const ubicacion = validar(esquemaUbicacionAvance, {
        latitud: leerCabecera(peticion.headers[CABECERA_LATITUD]),
        longitud: leerCabecera(peticion.headers[CABECERA_LONGITUD]),
        precisionMetros: leerCabecera(peticion.headers[CABECERA_PRECISION]),
        referenciaUbicacion: leerCabecera(peticion.headers[CABECERA_REFERENCIA], true),
      });

      const avance = await registrarAvanceActividad(
        peticion.user,
        idObra,
        idActividad,
        { datos: cuerpo, tipo },
        comentario ?? '',
        tipoAvance,
        ubicacion,
      );
      return respuesta.status(CODIGO_CREADO).send({ avance });
    },
  );

  // Revisión del supervisor de la obra o del dueño (D-10, feature 003).
  app.patch(
    '/:idObra/actividades/:idActividad/avances/:idAvance/revision',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO, Rol.SUPERVISOR)] },
    async (peticion) => {
      const { idObra, idActividad, idAvance } = validar(esquemaParametrosAvance, peticion.params);
      const datos = validar(esquemaRevisionAvance, peticion.body);
      return revisarAvance(peticion.user, idObra, idActividad, idAvance, datos);
    },
  );

  app.get(
    '/:idObra/actividades/:idActividad/avances/:idAvance/foto',
    { preHandler: [verificarToken] },
    async (peticion, respuesta) => {
      const { idObra, idActividad, idAvance } = validar(esquemaParametrosAvance, peticion.params);
      const { datos, tipo } = await obtenerFotoAvance(peticion.user, idObra, idActividad, idAvance);
      return respuesta.header('Cache-Control', 'private, no-cache').type(tipo).send(datos);
    },
  );
}

/**
 * Registra /actividades/mias (el prefijo /actividades lo pone quien la registra): las actividades
 * activas del trabajador en todas sus obras (feature 003, TRA VER ACTIVIDADES).
 *
 * @param app - Instancia de Fastify donde se registra la ruta.
 */
export async function rutasMisActividades(app: FastifyInstance): Promise<void> {
  app.get(
    '/mias',
    { preHandler: [verificarToken, exigirRol(Rol.TRABAJADOR)] },
    async (peticion) => ({
      actividades: await listarMisActividades(peticion.user),
    }),
  );
}
