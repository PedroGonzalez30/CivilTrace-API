/**
 * @archivo tokens.ts
 * @proyecto Civil Trace
 * @descripcion Genera tokens de refresco aleatorios y calcula su hash para guardarlos.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { createHash, randomBytes } from 'node:crypto';

// 3. Constantes del módulo
const BYTES_TOKEN_REFRESCO = 32;

// 4. Funciones
/**
 * Genera un token de refresco opaco de 256 bits.
 *
 * @returns Token en base64url (es lo que recibe la app).
 */
export function generarTokenRefresco(): string {
  return randomBytes(BYTES_TOKEN_REFRESCO).toString('base64url');
}

/**
 * Calcula el hash que se guarda en la base en lugar del token. Como el token ya es aleatorio
 * de 256 bits, basta SHA-256 (no hace falta un hash lento como el de las contraseñas).
 *
 * @param token - Token de refresco en texto.
 * @returns Hash hexadecimal.
 */
export function calcularHashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
