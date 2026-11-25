/**
 * @archivo esquemasObra.ts
 * @proyecto Civil Trace
 * @descripcion Esquema Zod de la petición para crear una obra.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.2.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - El supervisor es obligatorio (D-24, feature 002)
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MINIMA_NOMBRE_OBRA = 3;
const LONGITUD_MAXIMA_NOMBRE_OBRA = 120;
const LONGITUD_MINIMA_DESCRIPCION = 10;
const LONGITUD_MAXIMA_DESCRIPCION = 1000;
const LONGITUD_MAXIMA_CLIENTE = 100;
const LONGITUD_MAXIMA_CORREO = 254;
const LONGITUD_MINIMA_DIRECCION = 5;
const LONGITUD_MAXIMA_DIRECCION = 200;
const LONGITUD_MAXIMA_ID = 64;
const MENSAJE_SUPERVISOR_REQUERIDO = 'Selecciona un supervisor para la obra';
const MAXIMO_TRABAJADORES_POR_OBRA = 500;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';

export const esquemaCrearObra = z
  .object(
    {
      nombre: z
        .string({ error: 'El nombre de la obra es requerido' })
        .trim()
        .min(LONGITUD_MINIMA_NOMBRE_OBRA, {
          error: `Mínimo ${LONGITUD_MINIMA_NOMBRE_OBRA} caracteres en el nombre de la obra`,
        })
        .max(LONGITUD_MAXIMA_NOMBRE_OBRA, { error: 'El nombre de la obra es demasiado largo' }),
      descripcion: z
        .string({ error: 'La descripción es requerida' })
        .trim()
        .min(LONGITUD_MINIMA_DESCRIPCION, {
          error: `Mínimo ${LONGITUD_MINIMA_DESCRIPCION} caracteres en la descripción`,
        })
        .max(LONGITUD_MAXIMA_DESCRIPCION, { error: 'La descripción es demasiado larga' }),
      cliente: z
        .string({ error: 'El nombre del cliente es requerido' })
        .trim()
        .min(1, { error: 'El nombre del cliente es requerido' })
        .max(LONGITUD_MAXIMA_CLIENTE, { error: 'El nombre del cliente es demasiado largo' }),
      correoCliente: z
        .string({ error: 'El correo del cliente es requerido' })
        .trim()
        .toLowerCase()
        .max(LONGITUD_MAXIMA_CORREO, { error: 'Correo del cliente inválido' })
        .pipe(z.email({ error: 'Correo del cliente inválido' })),
      direccion: z
        .string({ error: 'La dirección es requerida' })
        .trim()
        .min(LONGITUD_MINIMA_DIRECCION, { error: 'La dirección es demasiado corta' })
        .max(LONGITUD_MAXIMA_DIRECCION, { error: 'La dirección es demasiado larga' }),
      // Las fechas viajan en ISO 8601 (AAAA-MM-DD); la app las muestra como DD/MM/AAAA.
      fechaInicio: z.iso.date({ error: 'Fecha de inicio inválida' }),
      fechaFinal: z.iso.date({ error: 'Fecha de fin inválida' }),
      // Obligatorio (D-24): toda obra nueva necesita quien registre la asistencia. El servicio
      // comprueba que el supervisor sea de la empresa.
      supervisorId: z
        .string({ error: MENSAJE_SUPERVISOR_REQUERIDO })
        .trim()
        .min(1, { error: MENSAJE_SUPERVISOR_REQUERIDO })
        .max(LONGITUD_MAXIMA_ID, { error: 'Supervisor inválido' }),
      trabajadoresIds: z
        .array(
          z
            .string({ error: 'Trabajador inválido' })
            .trim()
            .min(1, { error: 'Trabajador inválido' })
            .max(LONGITUD_MAXIMA_ID, { error: 'Trabajador inválido' }),
          { error: 'Lista de trabajadores inválida' },
        )
        .max(MAXIMO_TRABAJADORES_POR_OBRA, { error: 'Demasiados trabajadores en una obra' })
        .default([]),
    },
    { error: MENSAJE_DATOS_INVALIDOS },
  )
  // Comparar texto ISO funciona porque AAAA-MM-DD ordena igual que las fechas.
  .refine((datos) => datos.fechaFinal >= datos.fechaInicio, {
    error: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['fechaFinal'],
  });

export type DatosCrearObra = z.output<typeof esquemaCrearObra>;

// Feature 006 (RF-68): trabajadores a asignar a una obra ya creada.
export const esquemaAsignarTrabajadores = z.object(
  {
    trabajadoresIds: z
      .array(z.string().trim().min(1).max(LONGITUD_MAXIMA_ID), {
        error: 'Selecciona al menos un trabajador',
      })
      .min(1, { error: 'Selecciona al menos un trabajador' })
      .max(MAXIMO_TRABAJADORES_POR_OBRA, { error: 'Demasiados trabajadores' }),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);
