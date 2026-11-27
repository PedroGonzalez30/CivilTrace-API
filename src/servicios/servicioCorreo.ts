/**
 * @archivo servicioCorreo.ts
 * @proyecto Civil Trace
 * @descripcion Envía correos con Azure Communication Services usando la identidad administrada del
 *   App Service (T-03). Lo usan el enlace del portal, el aviso de entrega y el código de un solo
 *   uso. En las pruebas se sustituye con pruebas/configuracion/dobleCorreo.ts.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.1.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-13 Enviar entrega al cliente,
 *   RF-14 Registrar aceptación de entrega
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 *   26/11/2026 - Emilio Manuel Esquivel - Imágenes en línea (logo de la empresa) y "responder a"
 */

// 1. Importaciones
import { EmailClient } from '@azure/communication-email';
import { DefaultAzureCredential } from '@azure/identity';

import { entorno } from '@/configuracion/entorno';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
/** Imagen incrustada en el HTML; se cita como `<img src="cid:<idContenido>">`. */
export interface ImagenEnLinea {
  idContenido: string;
  nombre: string;
  tipo: string;
  datos: Buffer;
}

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
  /** Correo al que llegan las respuestas (p. ej. el de la empresa), en lugar del remitente. */
  responderA?: string;
  imagenes?: ImagenEnLinea[];
}

// 3. Constantes del módulo
const CODIGO_FALLO_CORREO = 502;
const CODIGO_NO_DISPONIBLE = 503;
const ESTADO_ENVIADO = 'Succeeded';

let clienteEnCache: EmailClient | null = null;

// 4. Funciones
function obtenerCliente(): { cliente: EmailClient; remitente: string } {
  const { AZURE_COMUNICACION_ENDPOINT, CORREO_REMITENTE } = entorno;
  if (!AZURE_COMUNICACION_ENDPOINT || !CORREO_REMITENTE) {
    throw new ErrorHttp(CODIGO_NO_DISPONIBLE, 'El envío de correos no está configurado');
  }
  clienteEnCache ??= new EmailClient(AZURE_COMUNICACION_ENDPOINT, new DefaultAzureCredential());
  return { cliente: clienteEnCache, remitente: CORREO_REMITENTE };
}

/**
 * Envía un correo y espera a que Azure confirme el envío.
 *
 * Con `CORREO_EN_CONSOLA=true` (solo desarrollo local) el mensaje se escribe en la consola en
 * lugar de enviarse, para probar el portal sin Azure.
 *
 * @param mensaje - Destinatario, asunto y contenido en texto y HTML.
 * @throws ErrorHttp 503 si el correo no está configurado.
 * @throws ErrorHttp 502 si Azure rechaza o no confirma el envío.
 */
export async function enviarCorreo(mensaje: MensajeCorreo): Promise<void> {
  if (entorno.CORREO_EN_CONSOLA && entorno.NODE_ENV !== 'production') {
    console.info(`[correo] Para: ${mensaje.para}\nAsunto: ${mensaje.asunto}\n${mensaje.texto}`);
    return;
  }

  const { cliente, remitente } = obtenerCliente();
  try {
    const envio = await cliente.beginSend({
      senderAddress: remitente,
      content: { subject: mensaje.asunto, plainText: mensaje.texto, html: mensaje.html },
      recipients: { to: [{ address: mensaje.para }] },
      ...(mensaje.responderA && { replyTo: [{ address: mensaje.responderA }] }),
      ...(mensaje.imagenes?.length && {
        attachments: mensaje.imagenes.map((imagen) => ({
          name: imagen.nombre,
          contentType: imagen.tipo,
          contentInBase64: imagen.datos.toString('base64'),
          contentId: imagen.idContenido,
        })),
      }),
    });
    const resultado = await envio.pollUntilDone();
    if (resultado.status !== ESTADO_ENVIADO) {
      throw new Error(`Estado del envío: ${resultado.status}`);
    }
  } catch (error) {
    throw new ErrorHttp(CODIGO_FALLO_CORREO, 'No se pudo enviar el correo', error);
  }
}
