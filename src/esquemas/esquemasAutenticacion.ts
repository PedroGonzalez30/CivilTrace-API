/**
 * @archivo esquemasAutenticacion.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas Zod de las peticiones de registro, login y tokens.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { z } from 'zod';

import {
  LONGITUD_MAXIMA_CONTRASENA,
  LONGITUD_MINIMA_CONTRASENA,
} from '@/constantes/autenticacion';
import { Rol } from '@/generated/prisma/enums';

// 3. Constantes del módulo
const LONGITUD_MINIMA_NOMBRE = 3;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_CORREO = 254;
const LONGITUD_MAXIMA_EMPRESA = 100;
const LONGITUD_MINIMA_TOKEN = 20;
const LONGITUD_MAXIMA_TOKEN = 200;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';

// El correo se guarda normalizado: sin espacios y en minúsculas.
const correo = z
  .string({ error: 'El correo es requerido' })
  .trim()
  .toLowerCase()
  .max(LONGITUD_MAXIMA_CORREO, { error: 'Correo inválido' })
  .pipe(z.email({ error: 'Correo inválido' }));

// La contraseña no se recorta: los espacios pueden ser parte de ella.
const contrasenaNueva = z
  .string({ error: 'La contraseña es requerida' })
  .min(LONGITUD_MINIMA_CONTRASENA, {
    error: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
  })
  .max(LONGITUD_MAXIMA_CONTRASENA, { error: 'La contraseña es demasiado larga' });

const tokenRefresco = z
  .string({ error: 'Falta el token de refresco' })
  .min(LONGITUD_MINIMA_TOKEN, { error: 'Token de refresco inválido' })
  .max(LONGITUD_MAXIMA_TOKEN, { error: 'Token de refresco inválido' });

export const esquemaRegistro = z.object(
  {
    nombre: z
      .string({ error: 'El nombre es requerido' })
      .trim()
      .min(LONGITUD_MINIMA_NOMBRE, { error: `Mínimo ${LONGITUD_MINIMA_NOMBRE} caracteres en el nombre` })
      .max(LONGITUD_MAXIMA_NOMBRE, { error: 'El nombre es demasiado largo' }),
    correo,
    contrasena: contrasenaNueva,
    rol: z.enum(Rol, { error: 'Rol inválido' }),
    // Dueño: nombre de la empresa. Supervisor y trabajador: código de acceso.
    empresa: z
      .string({ error: 'La empresa es requerida' })
      .trim()
      .min(1, { error: 'La empresa es requerida' })
      .max(LONGITUD_MAXIMA_EMPRESA, { error: 'El dato de la empresa es demasiado largo' }),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaLogin = z.object(
  {
    correo,
    // En el login solo se exige que venga algo; no se revela la regla de longitud.
    contrasena: z
      .string({ error: 'La contraseña es requerida' })
      .min(1, { error: 'La contraseña es requerida' })
      .max(LONGITUD_MAXIMA_CONTRASENA, { error: 'Correo o contraseña incorrectos' }),
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaTokenRefresco = z.object({ tokenRefresco }, { error: MENSAJE_DATOS_INVALIDOS });

export const esquemaUnirseEmpresa = esquemaLogin.extend({
  codigo: z
    .string({ error: 'El código es requerido' })
    .trim()
    .min(1, { error: 'El código es requerido' })
    .max(LONGITUD_MAXIMA_EMPRESA, { error: 'Código de empresa inválido' }),
});

export type DatosRegistro = z.output<typeof esquemaRegistro>;
export type DatosLogin = z.output<typeof esquemaLogin>;
export type DatosUnirseEmpresa = z.output<typeof esquemaUnirseEmpresa>;
