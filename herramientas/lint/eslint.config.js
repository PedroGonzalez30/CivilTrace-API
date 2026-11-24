/**
 * @archivo eslint.config.js
 * @proyecto Civil Trace
 * @descripcion Configuración de ESLint de la API. Vive aquí, aislada, porque TypeScript 7 no trae
 *   la API de JavaScript que usa typescript-eslint (decisión T-07). Se ejecuta con `npm run lint`
 *   desde la raíz del repositorio.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos ECCT v1.0 (constitución, principio II)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// 4. Configuración principal
export default tseslint.config(
  {
    ignores: ['src/generated/**', 'node_modules/**', 'coverage/**', 'dist/**', 'herramientas/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Prettier va antes de las reglas del ECCT: si va después, apaga 'curly'.
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Reglas del ECCT que se pueden automatizar.
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
