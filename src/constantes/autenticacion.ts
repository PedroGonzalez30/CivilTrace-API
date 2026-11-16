/**
 * @archivo autenticacion.ts
 * @proyecto Civil Trace
 * @descripcion Constantes de duración de sesiones y reglas de contraseña.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

const MILISEGUNDOS_POR_MINUTO = 60 * 1000;
const MILISEGUNDOS_POR_DIA = 24 * 60 * MILISEGUNDOS_POR_MINUTO;

export const MINUTOS_VIDA_TOKEN_ACCESO = 15;
export const DURACION_TOKEN_ACCESO = `${MINUTOS_VIDA_TOKEN_ACCESO}m`;
export const DURACION_TOKEN_ACCESO_MS = MINUTOS_VIDA_TOKEN_ACCESO * MILISEGUNDOS_POR_MINUTO;
export const DURACION_TOKEN_REFRESCO_MS = 30 * MILISEGUNDOS_POR_DIA;

export const LONGITUD_MINIMA_CONTRASENA = 8;
// Argon2 es costoso: sin tope, una contraseña enorme serviría para saturar el servidor.
export const LONGITUD_MAXIMA_CONTRASENA = 128;

// Límites de intentos por IP en las rutas sensibles.
export const MAXIMO_INTENTOS_LOGIN = 10;
export const MAXIMO_INTENTOS_REGISTRO = 10;
export const MAXIMO_INTENTOS_REFRESCO = 30;
export const VENTANA_INTENTOS = '15 minutes';
