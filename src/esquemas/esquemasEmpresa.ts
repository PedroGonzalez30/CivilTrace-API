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
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_CORREO = 254;
const LONGITUD_MAXIMA_DESCRIPCION = 500;
const LONGITUD_MAXIMA_DIRECCION = 200;

export const esquemaIdPersona = z.object({
  idPersona: z
    .string({ error: 'Persona inválida' })
    .trim()
    .min(1, { error: 'Persona inválida' })
    .max(LONGITUD_MAXIMA_ID, { error: 'Persona inválida' }),
});
export const esquemaTipoCodigo = z.object({
  tipo: z.enum(['trabajadores', 'supervisores'], { error: 'Tipo de código inválido' }),
});
// Un campo opcional vacío se guarda como null.
const textoOpcional = (maximo: number, mensaje: string) =>
  z
    .string({ error: mensaje })
    .trim()
    .max(maximo, { error: mensaje })
    .transform((valor) => (valor === '' ? null : valor));

export const esquemaActualizarEmpresa = z.object({
  nombre: z
    .string({ error: 'El nombre de la empresa es requerido' })
    .trim()
    .min(1, { error: 'El nombre de la empresa es requerido' })
    .max(LONGITUD_MAXIMA_NOMBRE, { error: 'El nombre de la empresa es demasiado largo' }),
  correo: z
    .string({ error: 'Correo inválido' })
    .trim()
    .toLowerCase()
    .max(LONGITUD_MAXIMA_CORREO, { error: 'Correo inválido' })
    .refine((valor) => valor === '' || z.email().safeParse(valor).success, {
      error: 'Correo inválido',
    })
    .transform((valor) => (valor === '' ? null : valor)),
  descripcion: textoOpcional(LONGITUD_MAXIMA_DESCRIPCION, 'La descripción es demasiado larga'),
  direccion: textoOpcional(LONGITUD_MAXIMA_DIRECCION, 'La dirección es demasiado larga'),
});

export type DatosActualizarEmpresa = z.output<typeof esquemaActualizarEmpresa>;
