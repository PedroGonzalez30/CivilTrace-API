/**
 * @archivo servicioEnlacePortal.ts
 * @proyecto Civil Trace
 * @descripcion Enlace permanente del portal web de cada obra: lo crea, lo manda por correo al
 *   cliente y lo vuelve a mandar. El token se guarda como hash (para buscarlo) y cifrado (para
 *   mandar siempre el mismo enlace, research R-03).
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.1.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-13 Enviar entrega al cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 *   25/11/2026 - Emilio Manuel Esquivel - Escribe en la consola por qué falló el envío
 */

// 1. Importaciones
import { randomBytes } from 'node:crypto';

import { prisma } from '@/baseDatos/clientePrisma';
import { entorno } from '@/configuracion/entorno';
import { BYTES_TOKEN_PORTAL } from '@/constantes/portal';
import { EstadoEnvioEnlace } from '@/generated/prisma/enums';
import { enviarCorreo } from '@/servicios/servicioCorreo';
import { cifrarTexto, descifrarTexto } from '@/utilidades/cifrado';
import { ErrorHttp } from '@/utilidades/errores';
import { calcularHashToken } from '@/utilidades/tokens';

// 2. Tipos e interfaces
/** Resultado del correo con el enlace que recibe la app (contrato, sección A). */
export type ResultadoEnlace = 'ENVIADO' | 'FALLIDO' | 'SIN_CORREO';

interface ObraParaEnlace {
  id: string;
  empresaId: string;
  nombre: string;
  correoCliente: string | null;
}

export interface MensajeAdicional {
  asunto: string;
  parrafos: string[];
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_NO_ENCONTRADO = 404;
const CODIGO_NO_DISPONIBLE = 503;

// 4. Funciones privadas
function obtenerLlave(): Buffer {
  if (!entorno.CLAVE_CIFRADO_PORTAL) {
    throw new ErrorHttp(CODIGO_NO_DISPONIBLE, 'El portal del cliente no está configurado');
  }
  return Buffer.from(entorno.CLAVE_CIFRADO_PORTAL, 'base64');
}

// El nombre de la obra lo escribe el usuario; se escapa antes de ponerlo en el HTML del correo.
function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function construirCorreoEnlace(
  obra: ObraParaEnlace,
  url: string,
  adicional?: MensajeAdicional,
): { asunto: string; texto: string; html: string } {
  const asunto = adicional?.asunto ?? `Sigue el avance de ${obra.nombre}`;
  const parrafos = adicional?.parrafos ?? [
    `Ya puedes consultar el avance de la obra ${obra.nombre}: actividades, fotografías y entregas.`,
  ];
  const cierre =
    'Guarda este enlace: es el mismo para toda la obra y no necesitas crear una cuenta.';
  const texto = [...parrafos, '', `Abre el portal: ${url}`, '', cierre].join('\n');
  const html = [
    ...parrafos.map((parrafo) => `<p>${escaparHtml(parrafo)}</p>`),
    `<p><a href="${url}">Abrir el portal de ${escaparHtml(obra.nombre)}</a></p>`,
    `<p>${cierre}</p>`,
    `<p style="color:#666">Si el botón no funciona, copia esta dirección: ${url}</p>`,
  ].join('');
  return { asunto, texto, html };
}

/**
 * Devuelve el token vigente de la obra. Lo crea si no existe y lo rota si cambió el correo del
 * cliente, para que quien tenía el enlace con el correo anterior pierda el acceso (P-12).
 */
async function obtenerTokenVigente(obra: ObraParaEnlace, correo: string): Promise<string> {
  const llave = obtenerLlave();
  const enlace = await prisma.enlacePortal.findUnique({ where: { obraId: obra.id } });
  if (enlace && enlace.correo === correo) {
    return descifrarTexto(enlace.tokenCifrado, llave);
  }

  const token = randomBytes(BYTES_TOKEN_PORTAL).toString('base64url');
  const datosToken = {
    tokenHash: calcularHashToken(token),
    tokenCifrado: cifrarTexto(token, llave),
    correo,
  };
  await prisma.enlacePortal.upsert({
    where: { obraId: obra.id },
    create: { obraId: obra.id, empresaId: obra.empresaId, ...datosToken },
    update: datosToken,
  });
  return token;
}

// 5. Funciones públicas
/**
 * @param token - Token del enlace en texto.
 * @returns La dirección del portal; el token va en el fragmento (#) para que no llegue al
 *   servidor de archivos estáticos ni al encabezado Referer (research R-03).
 */
export function construirUrlPortal(token: string): string {
  return `${entorno.URL_PORTAL.replace(/\/+$/, '')}/#/o/${token}`;
}

/**
 * Manda al cliente el enlace del portal de su obra, con un mensaje opcional (por ejemplo, el
 * aviso de una entrega). Nunca lanza error: el resultado se guarda y se devuelve para que la app
 * avise y ofrezca reenviar.
 *
 * @param obra - Obra con su correo del cliente.
 * @param adicional - Asunto y párrafos del aviso; sin él se manda el correo de bienvenida.
 * @returns `ENVIADO`, `FALLIDO` o `SIN_CORREO`.
 */
export async function enviarEnlacePortal(
  obra: ObraParaEnlace,
  adicional?: MensajeAdicional,
): Promise<ResultadoEnlace> {
  if (!obra.correoCliente) {
    return 'SIN_CORREO';
  }

  let estado: EstadoEnvioEnlace = EstadoEnvioEnlace.FALLIDO;
  try {
    const token = await obtenerTokenVigente(obra, obra.correoCliente);
    const correo = construirCorreoEnlace(obra, construirUrlPortal(token), adicional);
    await enviarCorreo({ para: obra.correoCliente, ...correo });
    estado = EstadoEnvioEnlace.ENVIADO;
  } catch (falla) {
    // La obra o la entrega ya se guardaron; el fallo queda registrado y la app ofrece reenviar.
    // El motivo (p. ej. falta CLAVE_CIFRADO_PORTAL o el correo) se escribe en la consola del
    // servidor; al usuario solo le llega "No se pudo enviar el correo".
    console.error(
      `[portal] No se pudo enviar el enlace de la obra ${obra.id}:`,
      falla instanceof Error ? falla.message : falla,
    );
  }

  await prisma.enlacePortal.updateMany({
    where: { obraId: obra.id },
    data: { estadoEnvio: estado, ultimoEnvioEn: new Date() },
  });
  return estado;
}

/**
 * Vuelve a mandar el enlace permanente de una obra (lo crea si la obra es anterior al portal).
 *
 * @param empresaId - Empresa del dueño (sale del token).
 * @param obraId - Obra de la empresa.
 * @returns `ENVIADO`.
 * @throws ErrorHttp 404 si la obra no es de la empresa; 400 si no tiene correo del cliente;
 *   503 si el correo falló o no está configurado.
 */
export async function reenviarEnlacePortal(empresaId: string, obraId: string): Promise<'ENVIADO'> {
  const obra = await prisma.obra.findFirst({
    where: { id: obraId, empresaId },
    select: { id: true, empresaId: true, nombre: true, correoCliente: true },
  });
  if (!obra) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Obra no encontrada');
  }
  if (!obra.correoCliente) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      'La obra no tiene correo del cliente',
      undefined,
      'SIN_CORREO_CLIENTE',
    );
  }

  const resultado = await enviarEnlacePortal(obra);
  if (resultado !== 'ENVIADO') {
    throw new ErrorHttp(CODIGO_NO_DISPONIBLE, 'No se pudo enviar el correo. Inténtalo más tarde');
  }
  return resultado;
}
