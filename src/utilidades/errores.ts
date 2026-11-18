/**
 * @archivo errores.ts
 * @proyecto Civil Trace
 * @descripcion Error HTTP controlado: el mensaje sí se le muestra al cliente.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

/**
 * Error esperado (datos inválidos, credenciales incorrectas...). El manejador global de
 * errores muestra su mensaje porque su código de estado es menor a 500.
 */
export class ErrorHttp extends Error {
  readonly statusCode: number;

  // "causa" guarda el error original para el registro del servidor; el cliente no la recibe.
  constructor(codigoEstado: number, mensaje: string, causa?: unknown) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorHttp';
    this.statusCode = codigoEstado;
  }
}
