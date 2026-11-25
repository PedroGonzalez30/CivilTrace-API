/**
 * @archivo esquemasPortal.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas zod de las rutas públicas del portal del cliente y de las rutas de la app
 *   para el enlace del portal.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente, RF-67 Consultar entregas en el portal del cliente, RF-14 Registrar aceptación de
 *   entrega, RF-15 Registrar observaciones del cliente, RF-60 Firmar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { z } from 'zod';

import {
  DIGITOS_CODIGO,
  LONGITUD_MAXIMA_NOMBRE_CLIENTE,
  LONGITUD_MAXIMA_OBSERVACIONES,
  LONGITUD_MINIMA_NOMBRE_CLIENTE,
  TAMANO_MAXIMO_FIRMA_BYTES,
} from '@/constantes/portal';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';
// Base64 ocupa 4 caracteres por cada 3 bytes; se deja margen para un prefijo data:.
const LONGITUD_MAXIMA_FIRMA_BASE64 = Math.ceil((TAMANO_MAXIMO_FIRMA_BYTES * 4) / 3) + 100;

const esquemaId = z.string().trim().min(1).max(LONGITUD_MAXIMA_ID);

export const esquemaParametrosObraEnlace = z.object(
  { idObra: esquemaId },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaParametrosFotoPortal = z.object(
  { idAvance: esquemaId },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaParametrosEntregaPortal = z.object(
  { idEntrega: esquemaId },
  { error: MENSAJE_DATOS_INVALIDOS },
);

const esquemaNombreCliente = z
  .string({ error: 'Escribe tu nombre completo' })
  .trim()
  .min(LONGITUD_MINIMA_NOMBRE_CLIENTE, { error: 'Escribe tu nombre completo' })
  .max(LONGITUD_MAXIMA_NOMBRE_CLIENTE, { error: 'El nombre es demasiado largo' });

// La firma se revisa a fondo en el servicio (PNG y tamaño) para responder FIRMA_INVALIDA; aquí
// solo se corta lo que no podría ser una firma aunque tuviera prefijo o relleno.
const esquemaFirma = z
  .string({ error: 'Dibuja tu firma para continuar' })
  .max(LONGITUD_MAXIMA_FIRMA_BASE64 * 2, { error: 'Dibuja tu firma para continuar' });

const esquemaCodigo = z
  .string({ error: 'Escribe el código que llegó a tu correo' })
  .trim()
  .regex(new RegExp(`^[0-9]{${DIGITOS_CODIGO}}$`), {
    error: `El código tiene ${DIGITOS_CODIGO} dígitos`,
  });

export const esquemaComprobarCodigo = z.object(
  { codigo: esquemaCodigo },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaAceptarEntrega = z.object(
  {
    codigo: z
      .string({ error: 'Escribe el código que llegó a tu correo' })
      .trim()
      .regex(new RegExp(`^[0-9]{${DIGITOS_CODIGO}}$`), {
        error: `El código tiene ${DIGITOS_CODIGO} dígitos`,
      }),
    nombre: esquemaNombreCliente,
    firmaPng: esquemaFirma,
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);

export const esquemaObservacionesEntrega = z.object(
  {
    observaciones: z
      .string({ error: 'Escribe qué debe corregirse' })
      .trim()
      .min(1, { error: 'Escribe qué debe corregirse' })
      .max(LONGITUD_MAXIMA_OBSERVACIONES, { error: 'Las observaciones son demasiado largas' }),
    nombre: esquemaNombreCliente,
    firmaPng: esquemaFirma,
  },
  { error: MENSAJE_DATOS_INVALIDOS },
);
