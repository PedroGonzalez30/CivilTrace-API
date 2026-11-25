/**
 * @archivo dobleCorreo.ts
 * @proyecto Civil Trace
 * @descripcion Doble del servicio de correo para las pruebas (constitución III.5): guarda los
 *   mensajes en memoria para leer el enlace del portal y el código de un solo uso, y puede
 *   simular un fallo de Azure.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-14 Registrar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { vi } from 'vitest';

import type { MensajeCorreo } from '@/servicios/servicioCorreo';

// 3. Constantes del módulo
const CODIGO_FALLO_CORREO = 502;

export const correosEnviados: MensajeCorreo[] = [];
const estado = { debeFallar: false };

// 4. Doble
vi.mock('@/servicios/servicioCorreo', async () => {
  const { ErrorHttp } = await import('@/utilidades/errores');
  return {
    enviarCorreo: async (mensaje: MensajeCorreo) => {
      if (estado.debeFallar) {
        throw new ErrorHttp(CODIGO_FALLO_CORREO, 'No se pudo enviar el correo');
      }
      correosEnviados.push(mensaje);
    },
  };
});

/**
 * @param para - Correo del destinatario.
 * @returns El último correo enviado a esa dirección, o `undefined`.
 */
export function obtenerUltimoCorreo(para: string): MensajeCorreo | undefined {
  return correosEnviados.filter((correo) => correo.para === para).at(-1);
}

/** Hace que los siguientes envíos fallen hasta llamar a `restaurarCorreo`. */
export function simularFalloCorreo(): void {
  estado.debeFallar = true;
}

/** Vacía la bandeja y quita el fallo simulado. */
export function restaurarCorreo(): void {
  estado.debeFallar = false;
  correosEnviados.length = 0;
}

/**
 * Extrae el token del enlace del portal (`…/#/o/<token>`) de un correo.
 *
 * @param correo - Mensaje enviado.
 * @returns El token, o `undefined` si el correo no trae enlace.
 */
export function extraerTokenPortal(correo: MensajeCorreo | undefined): string | undefined {
  return correo?.texto.match(/#\/o\/([A-Za-z0-9_-]+)/)?.[1];
}

/**
 * Extrae el código de 6 dígitos de un correo.
 *
 * @param correo - Mensaje enviado.
 * @returns El código, o `undefined`.
 */
export function extraerCodigo(correo: MensajeCorreo | undefined): string | undefined {
  return correo?.texto.match(/\b(\d{6})\b/)?.[1];
}
