/**
 * @archivo validar.ts
 * @proyecto Civil Trace
 * @descripcion Valida datos de entrada con Zod y lanza un ErrorHttp 400 si no cumplen.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import type { z } from 'zod';

import { ErrorHttp } from '@/utilidades/errores';

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;

// 4. Función principal
/**
 * Valida un valor desconocido contra un esquema de Zod.
 *
 * @param esquema - Esquema que describe los datos esperados.
 * @param datos - Valor recibido (por ejemplo, el cuerpo de la petición).
 * @returns Los datos ya validados y limpios.
 * @throws ErrorHttp 400 con el primer mensaje de error del esquema.
 */
export function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
  const resultado = esquema.safeParse(datos);

  if (!resultado.success) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      resultado.error.issues[0]?.message ?? 'Datos inválidos',
    );
  }

  return resultado.data;
}
