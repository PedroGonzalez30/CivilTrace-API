/**
 * @archivo esquemasAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas Zod de entrada de asistencia y horario de obra
 *   (contrato: specs/001-asistencia-qr-horario/contracts/asistencia-api.md).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, RNF-07 Captura sin conexión
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { z } from 'zod';

import {
  DIA_SEMANA_MAXIMO,
  DIA_SEMANA_MINIMO,
  LONGITUD_MAXIMA_ANOTACION,
  MAXIMO_ESCANEOS_POR_LOTE,
  TOLERANCIAS_PERMITIDAS,
} from '@/constantes/asistencia';
import { EfectoPago, MotivoAsistencia, TipoJornada } from '@/generated/prisma/enums';

// 3. Constantes del módulo
const LATITUD_MAXIMA = 90;
const LONGITUD_MAXIMA = 180;
const LONGITUD_MAXIMA_CODIGO_QR = 200;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// 4. Esquemas
export const esquemaFecha = z
  .string({ error: 'La fecha es inválida' })
  .regex(PATRON_FECHA, { error: 'La fecha debe tener el formato AAAA-MM-DD' })
  .refine((valor) => !Number.isNaN(new Date(`${valor}T00:00:00Z`).getTime()), {
    error: 'La fecha es inválida',
  });

export const esquemaParametrosObra = z.object({
  obraId: z.string({ error: 'La obra es inválida' }).min(1, { error: 'La obra es inválida' }),
});

export const esquemaParametrosTrabajador = esquemaParametrosObra.extend({
  trabajadorId: z
    .string({ error: 'El trabajador es inválido' })
    .min(1, { error: 'El trabajador es inválido' }),
});

export const esquemaConsultaFecha = z.object({ fecha: esquemaFecha.optional() });

export const esquemaVistaPrevia = z.object({
  codigoQr: z
    .string({ error: 'Escanea un código QR' })
    .min(1, { error: 'Escanea un código QR' })
    .max(LONGITUD_MAXIMA_CODIGO_QR, { error: 'El código no es de Civil Trace' }),
});

const esquemaEscaneo = esquemaVistaPrevia
  .extend({
    idLocal: z.uuid({ error: 'Cada escaneo necesita un identificador válido' }),
    obraId: z.string({ error: 'La obra es inválida' }).min(1, { error: 'La obra es inválida' }),
    capturadoEn: z.iso.datetime({ error: 'La hora del escaneo es inválida' }),
    sinConexion: z.boolean({ error: 'Indica si el escaneo fue sin conexión' }),
    latitud: z.number().min(-LATITUD_MAXIMA).max(LATITUD_MAXIMA).nullable().default(null),
    longitud: z.number().min(-LONGITUD_MAXIMA).max(LONGITUD_MAXIMA).nullable().default(null),
  })
  .refine((escaneo) => (escaneo.latitud === null) === (escaneo.longitud === null), {
    error: 'La ubicación debe tener latitud y longitud',
  });

export const esquemaLoteEscaneos = z.object({
  escaneos: z
    .array(esquemaEscaneo, { error: 'Envía al menos un escaneo' })
    .min(1, { error: 'Envía al menos un escaneo' })
    .max(MAXIMO_ESCANEOS_POR_LOTE, {
      error: `Envía como máximo ${MAXIMO_ESCANEOS_POR_LOTE} escaneos por vez`,
    }),
});

export type DatosEscaneo = z.output<typeof esquemaEscaneo>;

const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const esquemaHora = z
  .string({ error: 'La hora es inválida' })
  .regex(PATRON_HORA, { error: 'La hora debe tener el formato HH:MM (24 horas)' });

export const esquemaGuardarHorario = z
  .object({
    horaEntrada: esquemaHora,
    horaSalida: esquemaHora,
    toleranciaMinutos: z
      .number({ error: 'La tolerancia debe ser de 10, 15 o 20 minutos' })
      .refine((valor) => (TOLERANCIAS_PERMITIDAS as readonly number[]).includes(valor), {
        error: 'La tolerancia debe ser de 10, 15 o 20 minutos',
      }),
    diasLaborales: z
      .array(z.number().int().min(DIA_SEMANA_MINIMO).max(DIA_SEMANA_MAXIMO), {
        error: 'Los días laborales son inválidos',
      })
      .min(1, { error: 'Elige al menos un día laboral' })
      .transform((dias) => [...new Set(dias)].sort((a, b) => a - b)),
    alcance: z.enum(['TODOS_LOS_DIAS', 'SOLO_HOY'], {
      error: 'Elige si aplica a todos los días o solo hoy',
    }),
  })
  // "HH:MM" con ceros a la izquierda se puede comparar como texto.
  .refine((horario) => horario.horaSalida > horario.horaEntrada, {
    error: 'La hora de salida debe ser posterior a la de entrada',
  });

export type DatosGuardarHorario = z.output<typeof esquemaGuardarHorario>;

export const esquemaParametrosDia = esquemaParametrosTrabajador.extend({ fecha: esquemaFecha });

export const esquemaEditarDetalles = z
  .object({
    tipoJornada: z.enum(TipoJornada, { error: 'El tipo de jornada es inválido' }).optional(),
    motivo: z.enum(MotivoAsistencia, { error: 'El motivo es inválido' }).nullable().optional(),
    efectoPago: z.enum(EfectoPago, { error: 'El efecto en el pago es inválido' }).optional(),
    anotacion: z
      .string({ error: 'La observación es inválida' })
      .trim()
      .max(LONGITUD_MAXIMA_ANOTACION, { error: 'La observación es demasiado larga' })
      .transform((valor) => (valor === '' ? null : valor))
      .nullable()
      .optional(),
    entradaEn: z.iso.datetime({ error: 'La hora de entrada es inválida' }).nullable().optional(),
    salidaEn: z.iso.datetime({ error: 'La hora de salida es inválida' }).nullable().optional(),
  })
  .refine((cambios) => Object.values(cambios).some((valor) => valor !== undefined), {
    error: 'No hay cambios que guardar',
  });

export type DatosEditarDetalles = z.output<typeof esquemaEditarDetalles>;

export const esquemaParametrosCalendario = z.object({
  trabajadorId: z
    .string({ error: 'El trabajador es inválido' })
    .min(1, { error: 'El trabajador es inválido' }),
});

export const esquemaConsultaCalendario = z.object({
  mes: z
    .string({ error: 'Indica el mes' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'El mes debe tener el formato AAAA-MM' }),
  obraId: z.string().min(1, { error: 'La obra es inválida' }).optional(),
});

// Feature 005 (D-30): periodo de las métricas de desempeño.
export const esquemaConsultaDesempeno = z.object({
  periodo: z.enum(['SEMANA', 'MES', 'TODO'], { error: 'Periodo inválido' }).default('MES'),
});
