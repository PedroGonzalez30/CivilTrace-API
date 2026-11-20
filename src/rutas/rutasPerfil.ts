/**
 * @archivo rutasPerfil.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /perfil: consultar y actualizar los datos propios y la foto de perfil.
 *              Sirven para los tres roles; cada usuario solo ve y cambia lo suyo.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { entorno } from '@/configuracion/entorno';
import { esquemaActualizarPerfil } from '@/esquemas/esquemasPerfil';
import { verificarToken } from '@/middleware/autenticacion';
import { esTipoImagen } from '@/servicios/servicioAlmacenamiento';
import {
  actualizarPerfil,
  guardarFotoPerfil,
  obtenerFotoPerfil,
  obtenerPerfil,
} from '@/servicios/servicioPerfil';
import { ErrorHttp } from '@/utilidades/errores';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_SIN_CONTENIDO = 204;
const CODIGO_PETICION_INVALIDA = 400;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const LIMITE_CUERPO_BYTES = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;

// 4. Función principal
/**
 * Registra las rutas del perfil (el prefijo /perfil lo pone quien las registra).
 * La foto llega como cuerpo binario crudo, con cualquier Content-Type image/*.
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasPerfil(app: FastifyInstance): Promise<void> {
  // El analizador solo aplica dentro de este plugin; el resto de la API sigue igual.
  app.addContentTypeParser(
    /^image\/.+$/,
    { parseAs: 'buffer', bodyLimit: LIMITE_CUERPO_BYTES },
    (_peticion, cuerpo, terminar) => terminar(null, cuerpo),
  );

  app.get('/', { preHandler: [verificarToken] }, async (peticion) => ({
    perfil: await obtenerPerfil(peticion.user.sub),
  }));

  app.put('/', { preHandler: [verificarToken] }, async (peticion) => ({
    perfil: await actualizarPerfil(
      peticion.user.sub,
      validar(esquemaActualizarPerfil, peticion.body),
    ),
  }));

  app.post(
    '/foto',
    { preHandler: [verificarToken], bodyLimit: LIMITE_CUERPO_BYTES },
    async (peticion, respuesta) => {
      const cuerpo = peticion.body;
      const tipo = peticion.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
      if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0 || !esTipoImagen(tipo)) {
        throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Envía una imagen válida');
      }

      await guardarFotoPerfil(peticion.user.sub, peticion.user.empresaId, cuerpo, tipo);
      return respuesta.status(CODIGO_SIN_CONTENIDO).send();
    },
  );

  app.get('/foto', { preHandler: [verificarToken] }, async (peticion, respuesta) => {
    const { datos, tipo } = await obtenerFotoPerfil(peticion.user.sub);
    return respuesta.header('Cache-Control', 'private, no-cache').type(tipo).send(datos);
  });
}