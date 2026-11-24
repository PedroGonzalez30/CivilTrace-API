/**
 * @archivo vitest.config.ts
 * @proyecto Civil Trace
 * @descripcion Configuración de Vitest: pruebas en pruebas/, base de datos de prueba y cobertura
 *   mínima de 80 % en los servicios (constitución, principio III).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III (pruebas primero)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import 'dotenv/config';

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 3. Constantes del módulo
const UMBRAL_COBERTURA_LINEAS = 80;
const TIEMPO_MAXIMO_PRUEBA_MS = 20_000;

// 4. Configuración principal
// Las pruebas nunca deben tocar la base de desarrollo: si falta la de prueba, se detiene todo.
const urlBasePruebas = process.env['DATABASE_URL_PRUEBAS'];
if (!urlBasePruebas) {
  throw new Error('Falta DATABASE_URL_PRUEBAS en .env (ver .env.example)');
}

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['pruebas/**/*.test.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: urlBasePruebas,
      AZURE_STORAGE_CUENTA: 'cuentaprueba',
      AZURE_STORAGE_CONTENEDOR: 'contenedorprueba',
    },
    globalSetup: ['pruebas/configuracion/configuracionGlobal.ts'],
    setupFiles: ['pruebas/configuracion/dobleAlmacenamiento.ts'],
    // Todas las pruebas comparten una base; en serie se evitan interferencias entre archivos.
    fileParallelism: false,
    testTimeout: TIEMPO_MAXIMO_PRUEBA_MS,
    hookTimeout: TIEMPO_MAXIMO_PRUEBA_MS,
    coverage: {
      provider: 'v8',
      include: ['src/servicios/**'],
      // El 80 % se exige por archivo a los servicios que ya tienen pruebas. Los servicios
      // anteriores al módulo 00 (autenticación, obras, empresa, actividades, reportes,
      // almacenamiento) se agregan aquí conforme reciban sus pruebas.
      thresholds: {
        'src/servicios/servicio*Asistencia.ts': { lines: UMBRAL_COBERTURA_LINEAS },
        'src/servicios/servicioHorario.ts': { lines: UMBRAL_COBERTURA_LINEAS },
      },
      reporter: ['text', 'html'],
    },
  },
});
