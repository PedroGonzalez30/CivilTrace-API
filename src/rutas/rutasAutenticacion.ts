/**
 * @archivo rutasAutenticacion.ts
 * @proyecto Civil Trace
 * @descripcion Rutas /auth: registro, login, refresco, cierre de sesión y datos del usuario.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { FastifyInstance } from 'fastify';

import {
  DURACION_TOKEN_ACCESO_MS,
  MAXIMO_INTENTOS_LOGIN,
  MAXIMO_INTENTOS_REFRESCO,
  MAXIMO_INTENTOS_REGISTRO,
  VENTANA_INTENTOS,
} from '@/constantes/autenticacion';
import {
  esquemaLogin,
  esquemaRegistro,
  esquemaTokenRefresco,
} from '@/esquemas/esquemasAutenticacion';
import { verificarToken } from '@/middleware/autenticacion';
import {
  cerrarSesion,
  iniciarSesion,
  obtenerUsuarioActual,
  refrescarSesion,
  registrarUsuario,
  type ResultadoSesion,
} from '@/servicios/servicioAutenticacion';
import { validar } from '@/utilidades/validar';

// 3. Constantes del módulo
const CODIGO_CREADO = 201;
const CODIGO_SIN_CONTENIDO = 204;

const limiteDe = (maximo: number) => ({
  config: { rateLimit: { max: maximo, timeWindow: VENTANA_INTENTOS } },
});

// 4. Función principal
/**
 * Registra las rutas de autenticación (el prefijo /auth lo pone quien las registra).
 *
 * @param app - Instancia de Fastify donde se registran las rutas.
 */
export async function rutasAutenticacion(app: FastifyInstance): Promise<void> {
  // Arma lo que recibe la app: token de acceso corto, token de refresco y datos del usuario.
  const armarRespuesta = ({ usuario, tokenRefresco }: ResultadoSesion) => ({
    tokenAcceso: app.jwt.sign({ sub: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId }),
    tokenRefresco,
    // Marca de tiempo (ms) en que vence el token de acceso, para que la app sepa cuándo refrescar.
    venceEn: Date.now() + DURACION_TOKEN_ACCESO_MS,
    usuario,
  });

  app.post('/registro', limiteDe(MAXIMO_INTENTOS_REGISTRO), async (peticion, respuesta) => {
    const resultado = await registrarUsuario(validar(esquemaRegistro, peticion.body));
    return respuesta.status(CODIGO_CREADO).send(armarRespuesta(resultado));
  });

  app.post('/login', limiteDe(MAXIMO_INTENTOS_LOGIN), async (peticion) => {
    const resultado = await iniciarSesion(validar(esquemaLogin, peticion.body));
    return armarRespuesta(resultado);
  });

  app.post('/refrescar', limiteDe(MAXIMO_INTENTOS_REFRESCO), async (peticion) => {
    const { tokenRefresco } = validar(esquemaTokenRefresco, peticion.body);
    return armarRespuesta(await refrescarSesion(tokenRefresco));
  });

  app.post('/cerrar-sesion', limiteDe(MAXIMO_INTENTOS_REFRESCO), async (peticion, respuesta) => {
    const { tokenRefresco } = validar(esquemaTokenRefresco, peticion.body);
    await cerrarSesion(tokenRefresco);
    return respuesta.status(CODIGO_SIN_CONTENIDO).send();
  });

  // Ruta protegida de ejemplo: sirve para probar el middleware y para que la app valide su sesión.
  app.get('/yo', { preHandler: [verificarToken] }, async (peticion) => ({
    usuario: await obtenerUsuarioActual(peticion.user.sub),
  }));
}
