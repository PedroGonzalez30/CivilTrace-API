/**
 * @archivo esquemasActividad.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas Zod para validar parámetros y payloads de actividades y avances.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.1.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Descripción, fecha de inicio, tipo de avance y
 *   revisión de evidencias (feature 003)
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;
const LONGITUD_MINIMA_NOMBRE = 2;
const LONGITUD_MAXIMA_NOMBRE = 120;
const LONGITUD_MAXIMA_COMENTARIO = 500;
const LONGITUD_MAXIMA_DESCRIPCION = 1000;
const LONGITUD_MAXIMA_OBSERVACION = 500;
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

export const esquemaCrearActividad = z
  .object(
    {
      nombre: z
        .string({ error: 'El nombre de la actividad es requerido' })
        .trim()
        .min(LONGITUD_MINIMA_NOMBRE, {
          error: `Mínimo ${LONGITUD_MINIMA_NOMBRE} caracteres en el nombre`,
        })
        .max(LONGITUD_MAXIMA_NOMBRE, { error: 'El nombre de la actividad es demasiado largo' }),
      descripcion: z
        .string({ error: 'Descripción inválida' })
        .trim()
        .max(LONGITUD_MAXIMA_DESCRIPCION, { error: 'La descripción es demasiado larga' })
        .default(''),
      fechaInicio: z.iso.date({ error: 'Fecha de inicio inválida' }).optional(),
      fechaEntrega: z.iso.date({ error: 'Fecha de entrega inválida' }),
      responsableId: esquemaId.optional(),
    },
    { error: MENSAJE_DATOS_INVALIDOS },
  )
  // R8: comparar texto ISO funciona porque AAAA-MM-DD ordena igual que las fechas.
  .refine((datos) => !datos.fechaInicio || datos.fechaInicio <= datos.fechaEntrega, {
    error: 'La fecha de inicio no puede ser posterior a la de entrega',
    path: ['fechaInicio'],
  });

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

// Tipo de evidencia (cabecera x-tipo-avance); sin cabecera es un avance del día.
export const esquemaTipoAvance = z.object(
  {
    tipo: z
      .enum(['DIARIO', 'TERMINADO'], { error: 'Tipo de evidencia inválido' })
      .default('DIARIO'),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

// R5: al rechazar, la observación es obligatoria.
export const esquemaRevisionAvance = z
  .object(
    {
      decision: z.enum(['APROBAR', 'RECHAZAR'], { error: 'Decisión inválida' }),
      observacion: z
        .string({ error: 'Observación inválida' })
        .trim()
        .max(LONGITUD_MAXIMA_OBSERVACION, { error: 'La observación es demasiado larga' })
        .optional()
        .transform((valor) => (valor ? valor : undefined)),
    },
    { error: MENSAJE_DATOS_INVALIDOS },
  )
  .refine((datos) => datos.decision === 'APROBAR' || Boolean(datos.observacion), {
    error: 'Indica el motivo del rechazo',
    path: ['observacion'],
  });

export type DatosRevisionAvance = z.output<typeof esquemaRevisionAvance>;
export type DatosCrearActividad = z.output<typeof esquemaCrearActividad>;
export type DatosActualizarEstadoActividad = z.output<typeof esquemaActualizarEstadoActividad>;
