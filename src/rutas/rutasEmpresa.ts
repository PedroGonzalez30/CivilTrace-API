/**
 * @archivo rutasEmpresa.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /empresa: datos de la empresa del usuario (solo dueño).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { entorno } from '@/configuracion/entorno';
import {
  esquemaActualizarEmpresa,
  esquemaIdPersona,
  esquemaTipoCodigo,
} from '@/esquemas/esquemasEmpresa';
import { esTipoImagen } from '@/servicios/servicioAlmacenamiento';
import {
  actualizarDatosEmpresa,
  eliminarPersonalEmpresa,
  guardarLogoEmpresa,
  obtenerCodigosEmpresa,
  obtenerDatosEmpresa,
  obtenerLogoEmpresa,
  obtenerPersonalEmpresa,
  regenerarCodigoEmpresa,
} from '@/servicios/servicioEmpresa';
import { ErrorHttp } from '@/utilidades/errores';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_SIN_CONTENIDO = 204;
const CODIGO_PETICION_INVALIDA = 400;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const LIMITE_CUERPO_BYTES = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;

// 4. Función principal
/**
 * Registra las rutas de empresa (el prefijo /empresa lo pone quien las registra).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasEmpresa(app: FastifyInstance): Promise<void> {
  // El analizador solo aplica dentro de este plugin; el logotipo llega como cuerpo binario.
  app.addContentTypeParser(
    /^image\/.+$/,
    { parseAs: 'buffer', bodyLimit: LIMITE_CUERPO_BYTES },
    (_peticion, cuerpo, terminar) => terminar(null, cuerpo),
  );

  app.get(
    '/datos',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({ datos: await obtenerDatosEmpresa(peticion.user.empresaId) }),
  );

  app.put(
    '/datos',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({
      datos: await actualizarDatosEmpresa(
        peticion.user.empresaId,
        validar(esquemaActualizarEmpresa, peticion.body),
      ),
    }),
  );

  app.post(
    '/logo',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)], bodyLimit: LIMITE_CUERPO_BYTES },
    async (peticion, respuesta) => {
      const cuerpo = peticion.body;
      const tipo = peticion.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0 || !esTipoImagen(tipo)) {
        throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Envía una imagen válida');
      }
      await guardarLogoEmpresa(peticion.user.empresaId, cuerpo, tipo);
      return respuesta.status(CODIGO_SIN_CONTENIDO).send();
    },
  );

  app.get(
    '/logo',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion, respuesta) => {
      const { datos, tipo } = await obtenerLogoEmpresa(peticion.user.empresaId);
      return respuesta.header('Cache-Control', 'private, no-cache').type(tipo).send(datos);
    },
  );

  app.get(
    '/codigos',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({
      codigos: await obtenerCodigosEmpresa(peticion.user.empresaId),
    }),
  );

  app.get(
    '/personal',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => ({
      personal: await obtenerPersonalEmpresa(peticion.user.empresaId),
    }),
  );

  app.delete(
    '/personal/:idPersona',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion, respuesta) => {
      const { idPersona } = validar(esquemaIdPersona, peticion.params);
      await eliminarPersonalEmpresa(peticion.user.empresaId, idPersona);
      return respuesta.status(CODIGO_SIN_CONTENIDO).send();
    },
  );

  app.post(
    '/codigos/:tipo/regenerar',
    { preHandler: [verificarToken, exigirRol(Rol.DUENO)] },
    async (peticion) => {
      const { tipo } = validar(esquemaTipoCodigo, peticion.params);
      return { codigos: await regenerarCodigoEmpresa(peticion.user.empresaId, tipo) };
    },
  );
}
