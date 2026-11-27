/**
 * @archivo ubicacionEvidencia.ts
 * @proyecto Civil Trace
 * @descripcion Ubicación de una evidencia fotográfica: qué columnas leer, cómo devolverla en la
 *   respuesta y cómo describirla en los PDF. Si no hubo señal GPS, la foto lleva la referencia
 *   escrita por quien la tomó; las fotos de antes del feature 007 no tienen ninguna de las dos.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica, RF-12 Generar reporte de avance de obra,
 *   RF-66 Consultar avances en el portal del cliente
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 007)
 */

// 2. Tipos e interfaces
export interface UbicacionEvidencia {
  latitud: number;
  longitud: number;
  // Radio de error que reporta el teléfono; null si no lo dio.
  precisionMetros: number | null;
}

export interface DatosUbicacionEvidencia {
  ubicacion: UbicacionEvidencia | null;
  referenciaUbicacion: string | null;
}

// Decimal de Prisma (o cualquier valor que se pueda escribir como número).
type NumeroDecimal = { toString(): string };

export interface FilaUbicacionEvidencia {
  latitud: NumeroDecimal | null;
  longitud: NumeroDecimal | null;
  precisionMetros: number | null;
  referenciaUbicacion: string | null;
}

// 3. Constantes del módulo
const DECIMALES_COORDENADA = 6;
export const TEXTO_SIN_GPS = 'Sin ubicación GPS';
export const TEXTO_SIN_UBICACION = 'Ubicación no registrada';

export const SELECCION_UBICACION = {
  latitud: true,
  longitud: true,
  precisionMetros: true,
  referenciaUbicacion: true,
} as const;

// 4. Funciones
/**
 * Convierte las columnas de la base al formato de la respuesta.
 *
 * @param fila - Columnas de ubicación de un avance.
 * @returns Coordenadas (o null) y la referencia escrita (o null).
 */
export function convertirUbicacion(fila: FilaUbicacionEvidencia): DatosUbicacionEvidencia {
  const tieneCoordenadas = fila.latitud !== null && fila.longitud !== null;
  return {
    ubicacion: tieneCoordenadas
      ? {
          latitud: Number(fila.latitud?.toString()),
          longitud: Number(fila.longitud?.toString()),
          precisionMetros: fila.precisionMetros,
        }
      : null,
    referenciaUbicacion: fila.referenciaUbicacion,
  };
}

/**
 * Texto de la ubicación para el reporte y el acta en PDF.
 *
 * @returns "Ubicación: 32.624500, -115.452300", "Sin ubicación GPS · Referencia: …" o
 *   "Ubicación no registrada" para las fotos anteriores al feature 007.
 */
export function describirUbicacion(fila: FilaUbicacionEvidencia): string {
  const { ubicacion, referenciaUbicacion } = convertirUbicacion(fila);
  if (ubicacion) {
    return `Ubicación: ${ubicacion.latitud.toFixed(DECIMALES_COORDENADA)}, ${ubicacion.longitud.toFixed(DECIMALES_COORDENADA)}`;
  }
  if (referenciaUbicacion) {
    return `${TEXTO_SIN_GPS} · Referencia: ${referenciaUbicacion}`;
  }
  return TEXTO_SIN_UBICACION;
}
