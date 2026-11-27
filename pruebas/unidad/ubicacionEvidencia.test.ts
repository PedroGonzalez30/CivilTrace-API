/**
 * @archivo ubicacionEvidencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del texto de ubicación que llevan las fotos en el reporte y el acta en PDF.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-12 Generar reporte de avance de obra, RF-16 Generar acta de
 *   entrega-recepción
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 007)
 */

// 1. Importaciones
import { describe, expect, it } from 'vitest';

import { convertirUbicacion, describirUbicacion } from '@/utilidades/ubicacionEvidencia';

// 3. Constantes del módulo
const SIN_DATOS = {
  latitud: null,
  longitud: null,
  precisionMetros: null,
  referenciaUbicacion: null,
};

// 4. Pruebas
describe('Texto de la ubicación de una foto (feature 007)', () => {
  it('CP15-U1 con coordenadas muestra latitud y longitud con seis decimales', () => {
    expect(describirUbicacion({ ...SIN_DATOS, latitud: 32.6245, longitud: -115.4523 })).toBe(
      'Ubicación: 32.624500, -115.452300',
    );
  });

  it('CP15-U2 sin señal GPS muestra la referencia escrita', () => {
    expect(describirUbicacion({ ...SIN_DATOS, referenciaUbicacion: 'Azotea' })).toBe(
      'Sin ubicación GPS · Referencia: Azotea',
    );
  });

  it('CP15-U3 una foto de antes del feature 007 dice que no se registró', () => {
    expect(describirUbicacion(SIN_DATOS)).toBe('Ubicación no registrada');
    expect(convertirUbicacion(SIN_DATOS)).toEqual({ ubicacion: null, referenciaUbicacion: null });
  });

  it('CP15-U4 convierte el Decimal de la base a número', () => {
    const decimal = (valor: string) => ({ toString: () => valor });
    expect(
      convertirUbicacion({
        ...SIN_DATOS,
        latitud: decimal('19.432608'),
        longitud: decimal('-99.133209'),
      }).ubicacion,
    ).toEqual({ latitud: 19.432608, longitud: -99.133209, precisionMetros: null });
  });
});
