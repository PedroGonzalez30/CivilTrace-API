/**
 * @archivo servicioCodigoEntrega.ts
 * @proyecto Civil Trace
 * @descripcion Código de un solo uso que el cliente recibe por correo para aceptar una entrega:
 *   6 dígitos, guardado como HMAC, vence en 10 minutos y admite 5 intentos (constitución IV.3).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-14 Registrar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { randomInt, timingSafeEqual } from 'node:crypto';

import { prisma } from '@/baseDatos/clientePrisma';
import { entorno } from '@/configuracion/entorno';
import {
  DIGITOS_CODIGO,
  MAXIMO_INTENTOS_CODIGO,
  MINUTOS_VIGENCIA_CODIGO,
  SEGUNDOS_ENTRE_CODIGOS,
} from '@/constantes/portal';
import { enviarCorreo } from '@/servicios/servicioCorreo';
import { calcularHmacCodigo } from '@/utilidades/cifrado';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface CodigoSolicitado {
  correo: string;
  venceEn: string;
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_DEMASIADAS_PETICIONES = 429;
const MILISEGUNDOS_POR_MINUTO = 60_000;
const MILISEGUNDOS_POR_SEGUNDO = 1000;
const LETRAS_VISIBLES_CORREO = 2;

// 4. Funciones privadas
function generarCodigo(): string {
  return String(randomInt(0, 10 ** DIGITOS_CODIGO)).padStart(DIGITOS_CODIGO, '0');
}

// Solo se muestran las primeras letras del correo: confirma a dónde llegó sin revelarlo completo.
function enmascararCorreo(correo: string): string {
  const [usuario = '', dominio = ''] = correo.split('@');
  return `${usuario.slice(0, LETRAS_VISIBLES_CORREO)}***@${dominio}`;
}

function sonIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

// 5. Funciones públicas
/**
 * Genera un código nuevo, invalida los anteriores de la entrega y lo manda al correo del cliente.
 *
 * @param entregaId - Entrega Enviada (la ruta ya comprobó que es de la obra del enlace).
 * @param correoCliente - Correo del cliente de la obra.
 * @param nombreObra - Para el texto del correo.
 * @returns Correo enmascarado y vencimiento.
 * @throws ErrorHttp 429 si se pidió otro hace menos de un minuto; 502/503 si el correo falla.
 */
export async function solicitarCodigo(
  entregaId: string,
  correoCliente: string,
  nombreObra: string,
): Promise<CodigoSolicitado> {
  const ultimo = await prisma.codigoEntrega.findFirst({
    where: { entregaId },
    orderBy: { creadoEn: 'desc' },
    select: { creadoEn: true },
  });
  const limite = Date.now() - SEGUNDOS_ENTRE_CODIGOS * MILISEGUNDOS_POR_SEGUNDO;
  if (ultimo && ultimo.creadoEn.getTime() > limite) {
    throw new ErrorHttp(CODIGO_DEMASIADAS_PETICIONES, 'Espera un minuto para pedir otro código');
  }

  const codigo = generarCodigo();
  const venceEn = new Date(Date.now() + MINUTOS_VIGENCIA_CODIGO * MILISEGUNDOS_POR_MINUTO);
  await prisma.$transaction([
    prisma.codigoEntrega.updateMany({
      where: { entregaId, invalidado: false, usadoEn: null },
      data: { invalidado: true },
    }),
    prisma.codigoEntrega.create({
      data: { entregaId, codigoHash: calcularHmacCodigo(codigo, entorno.JWT_SECRETO), venceEn },
    }),
  ]);

  const texto = [
    `Tu código para aceptar la entrega de ${nombreObra} es: ${codigo}`,
    '',
    `Vence en ${MINUTOS_VIGENCIA_CODIGO} minutos. Si tú no lo pediste, ignora este correo.`,
  ].join('\n');
  await enviarCorreo({
    para: correoCliente,
    asunto: `Tu código de Civil Trace: ${codigo}`,
    texto,
    html: texto
      .split('\n')
      .filter((linea) => linea !== '')
      .map((linea) => `<p>${linea.replace(codigo, `<strong>${codigo}</strong>`)}</p>`)
      .join(''),
  });

  return { correo: enmascararCorreo(correoCliente), venceEn: venceEn.toISOString() };
}

/**
 * Comprueba el código vigente de la entrega. Un intento fallido cuenta aunque la aceptación no
 * siga, y al quinto el código se invalida. No lo marca como usado: eso pasa al aceptar.
 *
 * @param entregaId - Entrega Enviada.
 * @param codigo - Código que escribió el cliente.
 * @returns Id del código para marcarlo como usado.
 * @throws ErrorHttp 400 `CODIGO_VENCIDO` si no hay código vigente; `CODIGO_INCORRECTO` si no
 *   coincide (con los intentos restantes en el mensaje).
 */
export async function verificarCodigo(entregaId: string, codigo: string): Promise<string> {
  const vigente = await prisma.codigoEntrega.findFirst({
    where: { entregaId, invalidado: false, usadoEn: null, venceEn: { gt: new Date() } },
    orderBy: { creadoEn: 'desc' },
  });
  if (!vigente) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      'El código venció. Pide uno nuevo',
      undefined,
      'CODIGO_VENCIDO',
    );
  }

  if (sonIguales(vigente.codigoHash, calcularHmacCodigo(codigo, entorno.JWT_SECRETO))) {
    return vigente.id;
  }

  const actualizado = await prisma.codigoEntrega.update({
    where: { id: vigente.id },
    data: { intentos: { increment: 1 } },
    select: { intentos: true },
  });
  const restantes = MAXIMO_INTENTOS_CODIGO - actualizado.intentos;
  if (restantes <= 0) {
    await prisma.codigoEntrega.update({ where: { id: vigente.id }, data: { invalidado: true } });
  }
  throw new ErrorHttp(
    CODIGO_PETICION_INVALIDA,
    restantes > 0
      ? `Código incorrecto. Te quedan ${restantes} intentos`
      : 'Código incorrecto. Pide un código nuevo',
    undefined,
    'CODIGO_INCORRECTO',
  );
}

/**
 * @param codigoId - Código ya verificado.
 */
export async function marcarCodigoUsado(codigoId: string): Promise<void> {
  await prisma.codigoEntrega.update({ where: { id: codigoId }, data: { usadoEn: new Date() } });
}
