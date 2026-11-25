/**
 * @archivo esquemasEntregas.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas zod de las rutas de entregas de la app.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-13 Enviar entrega al cliente, RF-16 Generar acta de entrega-recepción
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';

const esquemaId = z.string().trim().min(1).max(LONGITUD_MAXIMA_ID);

// D-29: el supervisor elige un rango de fechas; la entrega lleva solo las fotos aprobadas.
export const esquemaEnviarEntrega = z
  .object(
    {
      fechaInicio: z.iso.date({ error: 'Fecha de inicio inválida' }),
      fechaFin: z.iso.date({ error: 'Fecha final inválida' }),
    },
    { error: MENSAJE_DATOS_INVALIDOS },
  )
  .refine((datos) => datos.fechaFin >= datos.fechaInicio, {
    error: 'La fecha final no puede ser anterior a la de inicio',
  });

export const esquemaParametrosEntrega = z.object(
  { idObra: esquemaId, idEntrega: esquemaId },
  { error: MENSAJE_DATOS_INVALIDOS },
);
