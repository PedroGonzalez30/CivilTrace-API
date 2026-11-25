/**
 * @archivo cifrado.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del cifrado del token del portal y del HMAC de los códigos de un solo uso.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-14 Registrar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { calcularHmacCodigo, cifrarTexto, descifrarTexto } from '@/utilidades/cifrado';

// 3. Constantes del módulo
const LLAVE = randomBytes(32);
const TOKEN = 'token-de-prueba-del-portal';

// 4. Pruebas
describe('cifrado', () => {
  it('CP16-PORTAL-A1 descifra el token cifrado con la misma llave', () => {
    const cifrado = cifrarTexto(TOKEN, LLAVE);

    expect(cifrado).not.toContain(TOKEN);
    expect(descifrarTexto(cifrado, LLAVE)).toBe(TOKEN);
  });

  it('CP16-PORTAL-A2 el mismo texto cifra distinto cada vez (vector de inicio nuevo)', () => {
    expect(cifrarTexto(TOKEN, LLAVE)).not.toBe(cifrarTexto(TOKEN, LLAVE));
  });

  it('CP16-PORTAL-A3 rechaza otra llave, un texto alterado o un formato inválido', () => {
    const cifrado = cifrarTexto(TOKEN, LLAVE);
    const [vector, etiqueta, texto] = cifrado.split(':') as [string, string, string];
    const alterado = [vector, etiqueta, Buffer.from('otro texto').toString('base64')].join(':');

    expect(() => descifrarTexto(cifrado, randomBytes(32))).toThrow();
    expect(() => descifrarTexto(alterado, LLAVE)).toThrow();
    expect(() => descifrarTexto(texto, LLAVE)).toThrow('Formato de texto cifrado inválido');
    expect(() => cifrarTexto(TOKEN, randomBytes(16))).toThrow('32 bytes');
  });

  it('CP17-A1 el HMAC del código depende del secreto y no revela el código', () => {
    const hmac = calcularHmacCodigo('123456', 'secreto-uno');

    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(hmac).toBe(calcularHmacCodigo('123456', 'secreto-uno'));
    expect(hmac).not.toBe(calcularHmacCodigo('123456', 'secreto-dos'));
    expect(hmac).not.toBe(calcularHmacCodigo('123457', 'secreto-uno'));
  });
});
