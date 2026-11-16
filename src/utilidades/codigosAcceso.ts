/**
 * @archivo codigosAcceso.ts
 * @proyecto Civil Trace
 * @descripcion Genera códigos de acceso de empresa aleatorios y seguros.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { randomBytes } from 'node:crypto';

// 3. Constantes del módulo
// 32 caracteres, sin I, O, 0 ni 1 para no confundirlos al dictarlos. Como 256 es múltiplo de
// 32, tomar 5 bits de cada byte no sesga la distribución.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MASCARA_5_BITS = 31;
const CARACTERES_POR_CODIGO = 12;
const CARACTERES_POR_GRUPO = 4;
const PREFIJO_CODIGO = 'CT';

// 4. Función principal
/**
 * Genera un código como CT-7K2M-QX9P-H4TA (60 bits de aleatoriedad, vía crypto.randomBytes).
 *
 * @returns Código de acceso en mayúsculas.
 */
export function generarCodigoAcceso(): string {
  const caracteres = Array.from(randomBytes(CARACTERES_POR_CODIGO), (byte) =>
    ALFABETO.charAt(byte & MASCARA_5_BITS),
  ).join('');

  const grupos: string[] = [];
  for (let inicio = 0; inicio < caracteres.length; inicio += CARACTERES_POR_GRUPO) {
    grupos.push(caracteres.slice(inicio, inicio + CARACTERES_POR_GRUPO));
  }

  return [PREFIJO_CODIGO, ...grupos].join('-');
}
