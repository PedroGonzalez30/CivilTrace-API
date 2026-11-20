/**
 * @archivo rutasActividades.ts
 * @proyecto Civil Trace
 * @descripcion Rutas de actividades y avances de una obra (listar, consultar detalle, crear,
 *              cambiar estado, subir evidencia fotográfica y descargar foto).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.1
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { entorno } from '@/configuracion/entorno';
import {
  esquemaActualizarEstadoActividad,
  esquemaComentarioAvance,
  esquemaCrearActividad,
  esquemaParametrosActividad,
  esquemaParametrosAvance,
  esquemaParametrosObra,
} from '@/esquemas/esquemasActividad';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import {
  actualizarEstadoActividad,
  crearActividadObra,
  listarActividadesObra,
  obtenerDetalleActividad,
  obtenerFotoAvance,
  registrarAvanceActividad,
} from '@/servicios/servicioActividades';
import { esTipoImagen } from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;
const CODIGO_PETICION_INVALIDA = 400;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const LIMITE_CUERPO_BYTES = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;
const CABECERA_COMENTARIO = 'x-comentario-avance';

// 4. Función principal
export async function rutasActividades(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser(
    /^image\/.+$/,
    { parseAs: 'buffer', bodyLimit: LIMITE_CUERPO_BYTES },
    (_peticion, cuerpo, terminar) => terminar(null, cuerpo),
  );

  app.get(
    '/:idObra/actividades',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { idObra } = validar(esquemaParametrosObra, peticion.params);
      return { actividades: await listarActividadesObra(peticion.user.empresaId, idObra) };
    },
  );

  app.get(
    '/:idObra/actividades/:idActividad',
    { preHandler: [verificarToken] },
    async (peticion) => {
      const { idObra, idActividad } = validar(esquemaParametrosActividad, peticion.params);
      return {
        actividad: await obtenerDetalleActividad(peticion.user.empresaId, idObra, idActividad),
      };
    },
  );

  app.post(
    '/:idObra/actividades',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO, Rol.SUPERVISOR)] },
    async (peticion, respuesta) => {
      const { idObra } = validar(esquemaParametrosObra, peticion.params);
      const datos = validar(esquemaCrearActividad, peticion.body);
      const actividad = await crearActividadObra(peticion.user.empresaId, idObra, datos);
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
        actividad: await actualizarEstadoActividad(
          peticion.user.empresaId,
          idObra,
          idActividad,
          datos,
        ),
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

      const avance = await registrarAvanceActividad(
        peticion.user.empresaId,
        peticion.user.sub,
        idObra,
        idActividad,
        { datos: cuerpo, tipo },
        comentario ?? '',
      );
      return respuesta.status(CODIGO_CREADO).send({ avance });
    },
  );

  app.get(
    '/:idObra/actividades/:idActividad/avances/:idAvance/foto',
    { preHandler: [verificarToken] },
    async (peticion, respuesta) => {
      const { idObra, idActividad, idAvance } = validar(esquemaParametrosAvance, peticion.params);
      const { datos, tipo } = await obtenerFotoAvance(
        peticion.user.empresaId,
        idObra,
        idActividad,
        idAvance,
      );
      return respuesta.header('Cache-Control', 'private, no-cache').type(tipo).send(datos);
    },
  );
}
