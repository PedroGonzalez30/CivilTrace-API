/**
 * @archivo imagenes.ts
 * @proyecto Civil Trace
 * @descripcion Revisa que un archivo subido sea de verdad una imagen por su firma de bytes.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (D-33)
 */

// 4. Funciones
/**
 * Revisa la firma de bytes del archivo: JPEG, PNG, WebP o HEIC/HEIF. Evita guardar como "foto"
 * algo que no lo es (por ejemplo el texto "File not found" que llegó de la app, D-33).
 *
 * @param datos - Bytes recibidos.
 * @returns true si empieza como una imagen de un formato aceptado.
 */
export function esContenidoImagen(datos: Buffer): boolean {
  const esJpeg = datos.length > 3 && datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
  const esPng = datos
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const esWebp =
    datos.subarray(0, 4).toString('latin1') === 'RIFF' &&
    datos.subarray(8, 12).toString('latin1') === 'WEBP';
  const marcaHeic = datos.subarray(8, 12).toString('latin1');
  const esHeic =
    datos.subarray(4, 8).toString('latin1') === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1', 'avif'].includes(marcaHeic);
  return esJpeg || esPng || esWebp || esHeic;
}
