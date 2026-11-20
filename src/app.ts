/**
 * @archivo app.ts
 * @proyecto Civil Trace
 * @descripcion Construye la aplicación Fastify con sus plugins de seguridad y sus rutas.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import '@/tipos/fastifyJwt';

import fastifyJwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError } from 'fastify';

import { DURACION_TOKEN_ACCESO } from '@/constantes/autenticacion';
import { entorno } from '@/configuracion/entorno';
import { rutasAutenticacion } from '@/rutas/rutasAutenticacion';
import { rutasSalud } from '@/rutas/rutasSalud';
import { rutasEmpresa } from '@/rutas/rutasEmpresa';
import { rutasObras } from '@/rutas/rutasObras';
import { rutasPruebaAlmacenamiento } from '@/rutas/rutasPruebaAlmacenamiento';
import { rutasPerfil } from '@/rutas/rutasPerfil';

// 3. Constantes del módulo
const LIMITE_TAMANO_PETICION_BYTES = 100 * 1024;
const MAXIMO_PETICIONES_POR_VENTANA = 100;
const VENTANA_LIMITE_PETICIONES = '1 minute';
const CODIGO_ERROR_SERVIDOR = 500;
const CODIGO_DEMASIADAS_PETICIONES = 429;

// 4. Función principal
/**
 * Crea la aplicación lista para escuchar peticiones.
 *
 * @returns La aplicación Fastify configurada.
 */
export async function construirApp() {
  const app = Fastify({
    logger: {
      level: entorno.NODE_ENV === 'production' ? 'info' : 'debug',
      // Nunca se registran los tokens de sesión.
      redact: ['req.headers.authorization'],
    },
    bodyLimit: LIMITE_TAMANO_PETICION_BYTES,
    // Detrás del proxy de Azure: así el límite de intentos cuenta la IP real de cada persona.
    trustProxy: true,
  });

  // El manejador de errores va ANTES de registrar plugins y rutas; si no, no les aplica.
  app.setErrorHandler((error: FastifyError, peticion, respuesta) => {
    const codigoEstado = error.statusCode ?? CODIGO_ERROR_SERVIDOR;

    if (codigoEstado >= CODIGO_ERROR_SERVIDOR) {
      peticion.log.error(error);
      return respuesta.status(CODIGO_ERROR_SERVIDOR).send({ mensaje: 'Error interno del servidor' });
    }

    if (codigoEstado === CODIGO_DEMASIADAS_PETICIONES) {
      return respuesta
        .status(CODIGO_DEMASIADAS_PETICIONES)
        .send({ mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo' });
    }

    return respuesta.status(codigoEstado).send({ mensaje: error.message });
  });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: MAXIMO_PETICIONES_POR_VENTANA,
    timeWindow: VENTANA_LIMITE_PETICIONES,
  });
  await app.register(fastifyJwt, {
    secret: entorno.JWT_SECRETO,
    sign: { expiresIn: DURACION_TOKEN_ACCESO },
  });
  await app.register(rutasSalud);
  await app.register(rutasAutenticacion, { prefix: '/auth' });
  await app.register(rutasEmpresa, { prefix: '/empresa' });
  await app.register(rutasObras, { prefix: '/obras' });
  // TEMPORAL: prueba de Blob Storage. Se reemplaza por las rutas de evidencias.
  await app.register(rutasPruebaAlmacenamiento, { prefix: '/almacenamiento-prueba' });
  await app.register(rutasPerfil, { prefix: '/perfil' });
  return app;
}