/**
 * @archivo esquemasPerfil.ts
 * @proyecto Civil Trace
 * @descripcion Esquema Zod de la actualización del perfil del usuario.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { z } from 'zod';

import { esquemaRegistro } from '@/esquemas/esquemasAutenticacion';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_TELEFONO = 20;

// Reutiliza las reglas de nombre y correo del registro; el teléfono es opcional.
export const esquemaActualizarPerfil = esquemaRegistro.pick({ nombre: true, correo: true }).extend({
  telefono: z
    .string({ error: 'El teléfono es inválido' })
    .trim()
    .max(LONGITUD_MAXIMA_TELEFONO, { error: 'El teléfono es demasiado largo' })
    .regex(/^[0-9+\-()\s]*$/, { error: 'El teléfono es inválido' })
    .transform((valor) => (valor === '' ? null : valor)),
});

export type DatosActualizarPerfil = z.output<typeof esquemaActualizarPerfil>;