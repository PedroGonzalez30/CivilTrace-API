/**
 * @archivo asistencia.ts
 * @proyecto Civil Trace
 * @descripcion Valores de negocio de asistencia y horario de obra.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el supervisor,
 *   RF-58 Mostrar calendario de asistencia, RF-60 Registrar retardo o salida anticipada,
 *   RNF-07 Captura sin conexión
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 3. Constantes del módulo
/** Tolerancias que ofrece la pantalla SUP_HorarioObra (D-06). */
export const TOLERANCIAS_PERMITIDAS = [10, 15, 20] as const;
export const TOLERANCIA_MINUTOS_POR_DEFECTO = 15;

/** Zona horaria con la que se crean las empresas (D-15). */
export const ZONA_HORARIA_POR_DEFECTO = 'America/Tijuana';

/** Límite de escaneos por envío; protege a la API de lotes enormes tras días sin señal. */
export const MAXIMO_ESCANEOS_POR_LOTE = 100;
/** Un registro sin conexión más viejo que esto se rechaza (research R-04). */
export const MAXIMO_DIAS_REGISTRO_SIN_CONEXION = 7;
/** Margen para relojes de teléfono adelantados (research R-04). */
export const MAXIMO_MINUTOS_EN_FUTURO = 5;

export const LONGITUD_MAXIMA_ANOTACION = 500;
export const LONGITUD_MAXIMA_OFICIO = 60;

/** Prefijo versionado del contenido del QR; permite cambiar el formato en el futuro. */
export const PREFIJO_QR = 'ct1.';
export const BYTES_TOKEN_QR = 32;

/** Días de la semana como los devuelve Date.getUTCDay(): 0 = domingo … 6 = sábado. */
export const DIA_SEMANA_MINIMO = 0;
export const DIA_SEMANA_MAXIMO = 6;
