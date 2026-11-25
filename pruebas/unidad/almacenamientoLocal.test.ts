/**
 * @archivo almacenamientoLocal.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas del almacenamiento en disco para desarrollo local (D-32).
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica (pruebas locales)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (D-32)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  borrarLocal,
  guardarLocal,
  leerLocal,
  usaAlmacenamientoLocal,
} from '@/servicios/almacenamientoLocal';

// 4. Pruebas
describe('almacenamientoLocal (D-32)', () => {
  it('D32-A1 guarda, lee con su tipo y borra un archivo', async () => {
    const nombre = `prueba/${randomUUID()}/foto.jpg`;
    const datos = Buffer.from('foto local');

    await guardarLocal(nombre, datos);
    const leido = await leerLocal(nombre);
    await borrarLocal(nombre);

    expect(leido.datos.equals(datos)).toBe(true);
    expect(leido.tipo).toBe('image/jpeg');
    await expect(leerLocal(nombre)).rejects.toThrow();
  });

  it('D32-A2 no permite salir de la carpeta y no se usa fuera de desarrollo', async () => {
    await expect(guardarLocal('../fuera.txt', Buffer.from('x'))).rejects.toThrow(
      'Nombre de archivo inválido',
    );
    expect(usaAlmacenamientoLocal()).toBe(false);
  });
});
