/**
 * @archivo rutasPruebaAlmacenamiento.ts
 * @proyecto Civil Trace
 * @descripcion Ruta TEMPORAL para probar la subida de fotos a Blob Storage (solo supervisor).
 * Se reemplazará por el endpoint real de evidencias.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 18/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import { entorno } from '@/configuracion/entorno';
import { Rol } from '@/generated/prisma/enums';
import { exigirRol, verificarToken } from '@/middleware/autenticacion';
import { guardarImagen } from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;
const CODIGO_PETICION_INVALIDA = 400;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const LIMITE_CUERPO_BYTES = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;
const CARPETA_PRUEBA = 'prueba';
const TIPO_PNG = 'image/png';

// 4. Función principal
/**
 * Registra la ruta de prueba (el prefijo lo pone quien la registra).
 * La imagen llega como cuerpo binario crudo (Content-Type image/jpeg o image/png).
 *
 * @param app - Instancia de Fastify donde se registra la ruta.
 */
export async function rutasPruebaAlmacenamiento(app: FastifyInstance): Promise<void> {
  // El analizador solo aplica dentro de este plugin; el resto de la API sigue igual.
  app.addContentTypeParser(
    ['image/jpeg', 'image/png'],
    { parseAs: 'buffer', bodyLimit: LIMITE_CUERPO_BYTES },
    (_peticion, cuerpo, terminar) => terminar(null, cuerpo),
  );

  app.post(
    '/foto',
    {
      preHandler: [verificarToken, exigirRol(Rol.SUPERVISOR)],
      bodyLimit: LIMITE_CUERPO_BYTES,
    },
    async (peticion, respuesta) => {
      const cuerpo = peticion.body;
      if (!Buffer.isBuffer(cuerpo) || cuerpo.length === 0) {
        throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Envía una imagen en formato JPEG o PNG');
      }

      const tipo = peticion.headers['content-type']?.startsWith(TIPO_PNG) ? TIPO_PNG : 'image/jpeg';
      const archivo = await guardarImagen(peticion.user.empresaId, CARPETA_PRUEBA, cuerpo, tipo);
      return respuesta.status(CODIGO_CREADO).send({ archivo });
    },
  );
}
