/**
 * @archivo errores.ts
 * @proyecto Civil Trace
 * @descripcion Error HTTP controlado: el mensaje sí se le muestra al cliente.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.1.0
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Agrega "motivo" opcional legible por la app
 *   (asistencia, feature 001)
 */

/**
 * Error esperado (datos inválidos, credenciales incorrectas...). El manejador global de
 * errores muestra su mensaje porque su código de estado es menor a 500.
 */
export class ErrorHttp extends Error {
  readonly statusCode: number;
  // Clave estable para que la app decida qué mostrar sin depender del texto del mensaje.
  readonly motivo: string | undefined;

  // "causa" guarda el error original para el registro del servidor; el cliente no la recibe.
  constructor(codigoEstado: number, mensaje: string, causa?: unknown, motivo?: string) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorHttp';
    this.statusCode = codigoEstado;
    this.motivo = motivo;
  }
}
