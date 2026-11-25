/**
 * @archivo esquemasPortal.ts
 * @proyecto Civil Trace
 * @descripcion Esquemas zod de las rutas públicas del portal del cliente y de las rutas de la app
 *   para el enlace del portal.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente, RF-67 Consultar entregas en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { z } from 'zod';

// 3. Constantes del módulo
const LONGITUD_MAXIMA_ID = 64;
const MENSAJE_DATOS_INVALIDOS = 'Datos inválidos';

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
