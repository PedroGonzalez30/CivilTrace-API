/**
 * @archivo portal.ts
 * @proyecto Civil Trace
 * @descripcion Valores de negocio del portal web del cliente y de las entregas.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-13 Enviar entrega al cliente, RF-14 Registrar aceptación de entrega,
 *   RF-15 Registrar observaciones del cliente, RF-60 Firmar aceptación de entrega,
 *   RF-65 Enviar enlace del portal al cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 3. Constantes del módulo
/** Token del enlace permanente de la obra: 256 bits (constitución IV.3 pide al menos 128). */
export const BYTES_TOKEN_PORTAL = 32;

/** Código de un solo uso para aceptar una entrega (constitución IV.3). */
export const DIGITOS_CODIGO = 6;
export const MINUTOS_VIGENCIA_CODIGO = 10;
export const MAXIMO_INTENTOS_CODIGO = 5;
/** Evita que se use la API para mandar muchos correos al cliente. */
export const SEGUNDOS_ENTRE_CODIGOS = 60;

/** La firma es un trazo sobre fondo blanco; 512 KB sobran y protegen al servidor. */
export const TAMANO_MAXIMO_FIRMA_BYTES = 512 * 1024;
/** Cuerpo de las rutas que reciben la firma en base64 (≈ 4/3 del PNG más el resto del JSON). */
export const LIMITE_CUERPO_FIRMA_BYTES = 1024 * 1024;

export const LONGITUD_MINIMA_NOMBRE_CLIENTE = 3;
export const LONGITUD_MAXIMA_NOMBRE_CLIENTE = 120;
export const LONGITUD_MAXIMA_OBSERVACIONES = 2000;

/** Límites de peticiones de las rutas públicas del portal (research R-09). */
export const MAXIMO_PETICIONES_PORTAL_POR_MINUTO = 30;
export const MAXIMO_CODIGOS_POR_MINUTO = 5;

/** Encabezado con el que el portal manda el token de su enlace. */
export const ENCABEZADO_TOKEN_PORTAL = 'x-token-portal';

/** Carpetas de Blob Storage (contenedor privado). */
export const CARPETA_FIRMAS = 'firmas';
export const CARPETA_ENTREGAS = 'entregas';
