/**
 * @archivo esquemasEmpresa.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas Zod de los parámetros de las rutas de empresa.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 19/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;

export const esquemaIdPersona = z.object({
  idPersona: z
    .string({ error: 'Persona inválida' })
    .trim()
    .min(1, { error: 'Persona inválida' })
    .max(LONGITUD_MAXIMA_ID, { error: 'Persona inválida' }),
});