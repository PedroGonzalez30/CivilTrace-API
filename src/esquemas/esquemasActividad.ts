/**
 * @archivo esquemasActividad.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas Zod para validar parámetros y payloads de actividades y avances.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;
const LONGITUD_MINIMA_NOMBRE = 2;
const LONGITUD_MAXIMA_NOMBRE = 120;
const LONGITUD_MAXIMA_COMENTARIO = 500;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';

const esquemaId = z
  .string({ error: 'Identificador inválido' })
  .trim()
  .min(1, { error: 'Identificador inválido' })
  .max(LONGITUD_MAXIMA_ID, { error: 'Identificador inválido' });

// 4. Esquemas
export const esquemaParametrosObra = z.object(
  {
    idObra: esquemaId,
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaParametrosActividad = z.object(
  {
    idObra: esquemaId,
    idActividad: esquemaId,
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaParametrosAvance = z.object(
  {
    idObra: esquemaId,
    idActividad: esquemaId,
    idAvance: esquemaId,
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaCrearActividad = z.object(
  {
    nombre: z
      .string({ error: 'El nombre de la actividad es requerido' })
      .trim()
      .min(LONGITUD_MINIMA_NOMBRE, {
        error: `Mínimo ${LONGITUD_MINIMA_NOMBRE} caracteres en el nombre`,
      })
      .max(LONGITUD_MAXIMA_NOMBRE, { error: 'El nombre de la actividad es demasiado largo' }),
    fechaEntrega: z.iso.date({ error: 'Fecha de entrega inválida' }),
    responsableId: esquemaId.optional(),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaActualizarEstadoActividad = z.object(
  {
    estado: z.enum(['ACTIVA', 'TERMINADA'], { error: 'Estado de actividad inválido' }),
    fechaTerminada: z.iso.date({ error: 'Fecha de terminación inválida' }).optional(),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaComentarioAvance = z.object(
  {
    comentario: z
      .string()
      .trim()
      .max(LONGITUD_MAXIMA_COMENTARIO, { error: 'El comentario es demasiado largo' })
      .optional(),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export type DatosCrearActividad = z.output<typeof esquemaCrearActividad>;
export type DatosActualizarEstadoActividad = z.output<typeof esquemaActualizarEstadoActividad>;
