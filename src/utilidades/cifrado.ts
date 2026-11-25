/**
 * @archivo cifrado.ts
 * @proyecto Civil Trace
 * @descripcion Cifrado AES-256-GCM del token del enlace del portal y HMAC de los códigos de un
 *   solo uso. Lo usan servicioEnlacePortal y servicioCodigoEntrega.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-14 Registrar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

// 3. Constantes del módulo
const ALGORITMO = 'aes-256-gcm';
// GCM recomienda un vector de inicio de 96 bits.
const BYTES_VECTOR_INICIO = 12;
const BYTES_LLAVE = 32;
const SEPARADOR = ':';
const PARTES_TEXTO_CIFRADO = 3;

// 4. Funciones
function validarLlave(llave: Buffer): void {
  if (llave.length !== BYTES_LLAVE) {
    throw new Error('La llave de cifrado debe medir 32 bytes');
  }
}

/**
 * Cifra un texto con AES-256-GCM. Cada llamada usa un vector de inicio nuevo, así que el mismo
 * texto produce resultados distintos.
 *
 * @param texto - Texto a cifrar.
 * @param llave - Llave de 32 bytes.
 * @returns `vectorInicio:etiqueta:textoCifrado`, cada parte en base64.
 * @throws Error si la llave no mide 32 bytes.
 */
export function cifrarTexto(texto: string, llave: Buffer): string {
  validarLlave(llave);
  const vectorInicio = randomBytes(BYTES_VECTOR_INICIO);
  const cifrador = createCipheriv(ALGORITMO, llave, vectorInicio);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return [vectorInicio, etiqueta, cifrado].map((parte) => parte.toString('base64')).join(SEPARADOR);
}

/**
 * Descifra un texto creado con `cifrarTexto`. La etiqueta de GCM detecta cualquier alteración.
 *
 * @param textoCifrado - Resultado de `cifrarTexto`.
 * @param llave - La misma llave de 32 bytes.
 * @returns El texto original.
 * @throws Error si el formato es inválido, la llave es otra o el texto se alteró.
 */
export function descifrarTexto(textoCifrado: string, llave: Buffer): string {
  validarLlave(llave);
  const partes = textoCifrado.split(SEPARADOR);
  if (partes.length !== PARTES_TEXTO_CIFRADO) {
    throw new Error('Formato de texto cifrado inválido');
  }
  const [vectorInicio, etiqueta, cifrado] = partes.map((parte) => Buffer.from(parte, 'base64')) as [
    Buffer,
    Buffer,
    Buffer,
  ];
  const descifrador = createDecipheriv(ALGORITMO, llave, vectorInicio);
  descifrador.setAuthTag(etiqueta);
  return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
}

/**
 * Calcula el HMAC-SHA256 de un código de un solo uso. Con solo un millón de códigos posibles, un
 * SHA-256 simple se rompería por fuerza bruta si se filtrara la base; la llave secreta lo evita
 * (research R-04).
 *
 * @param codigo - Código de 6 dígitos.
 * @param secreto - Secreto del servidor.
 * @returns HMAC en hexadecimal.
 */
export function calcularHmacCodigo(codigo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(`codigo-entrega:${codigo}`).digest('hex');
}
