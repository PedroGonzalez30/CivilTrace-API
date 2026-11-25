/**
 * @archivo dobleAlmacenamiento.ts
 * @proyecto Civil Trace
 * @descripcion Doble del servicio de almacenamiento: guarda las imágenes en memoria para que las
 *   pruebas nunca usen Azure (constitución III.5).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III.5
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';

// 3. Constantes del módulo
const CODIGO_FALLO_ALMACENAMIENTO = 502;

// Las imágenes viven en memoria mientras dura el archivo de prueba.
export const imagenesEnMemoria = new Map<string, { datos: Buffer; tipo: string }>();

// 4. Doble
vi.mock('@/servicios/servicioAlmacenamiento', async () => {
  const { ErrorHttp } = await import('@/utilidades/errores');
  return {
    esTipoImagen: (valor: string) => /^image\/[a-z0-9.+-]+$/i.test(valor),
    guardarImagen: async (empresaId: string, carpeta: string, datos: Buffer, tipo: string) => {
      const nombreBlob = `${empresaId}/${carpeta}/${randomUUID()}`;
      imagenesEnMemoria.set(nombreBlob, { datos, tipo });
      return { nombreBlob, tipo, tamanoBytes: datos.length };
    },
    obtenerImagen: async (nombreBlob: string) => {
      const imagen = imagenesEnMemoria.get(nombreBlob);
      if (!imagen) {
        throw new ErrorHttp(CODIGO_FALLO_ALMACENAMIENTO, 'No se pudo leer la imagen');
      }
      return imagen;
    },
    guardarPdf: async (empresaId: string, carpeta: string, datos: Buffer) => {
      const nombreBlob = `${empresaId}/${carpeta}/${randomUUID()}.pdf`;
      imagenesEnMemoria.set(nombreBlob, { datos, tipo: 'application/pdf' });
      return { nombreBlob, tipo: 'application/pdf', tamanoBytes: datos.length };
    },
    eliminarImagen: async (nombreBlob: string) => {
      imagenesEnMemoria.delete(nombreBlob);
    },
  };
});
