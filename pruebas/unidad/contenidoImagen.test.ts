/**
 * @archivo contenidoImagen.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de la revisión del contenido real de las imágenes que se suben (D-33).
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (D-33)
 */

// 1. Importaciones
import { describe, expect, it } from 'vitest';

import { esContenidoImagen } from '@/utilidades/imagenes';

// 3. Constantes del módulo
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const HEIC = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypheic'),
  Buffer.alloc(8),
]);

// 4. Pruebas
describe('esContenidoImagen (D-33)', () => {
  it('CP12-A12 acepta JPEG, PNG, WebP y HEIC', () => {
    for (const imagen of [JPEG, PNG, WEBP, HEIC]) {
      expect(esContenidoImagen(imagen)).toBe(true);
    }
  });

  it('CP12-A13 rechaza texto como "File not found" o un archivo vacío', () => {
    expect(esContenidoImagen(Buffer.from('File not found'))).toBe(false);
    expect(esContenidoImagen(Buffer.alloc(0))).toBe(false);
  });
});
