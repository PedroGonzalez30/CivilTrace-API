/**
 * @archivo servicioAlmacenamiento.ts
 * @proyecto Civil Trace
 * @descripcion Guarda imágenes en el contenedor privado de Azure Blob Storage, usando la
 * identidad administrada del App Service (sin claves ni cadenas de conexión).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 18/11/2026
 * @version 1.2.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - guardarPdf para reportes y actas de entregas
 *   (feature 004, RF-16 Generar acta de entrega-recepción)
 *   25/11/2026 - Emilio Manuel Esquivel - En desarrollo sin Azure guarda en disco (D-32)
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';

import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';

import { entorno } from '@/configuracion/entorno';
import {
  borrarLocal,
  guardarLocal,
  leerLocal,
  usaAlmacenamientoLocal,
} from '@/servicios/almacenamientoLocal';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export type TipoImagen = `image/${string}`;

export interface ArchivoGuardado {
  nombreBlob: string;
  tipo: TipoImagen | 'application/pdf';
  tamanoBytes: number;
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_FALLO_ALMACENAMIENTO = 502;
const CODIGO_NO_DISPONIBLE = 503;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const TIPO_PDF = 'application/pdf' as const;

let contenedorEnCache: ContainerClient | null = null;

// 4. Funciones privadas
function obtenerContenedor(): ContainerClient {
  if (contenedorEnCache) {
    return contenedorEnCache;
  }

  const { AZURE_STORAGE_CUENTA, AZURE_STORAGE_CONTENEDOR } = entorno;
  if (!AZURE_STORAGE_CUENTA || !AZURE_STORAGE_CONTENEDOR) {
    throw new ErrorHttp(CODIGO_NO_DISPONIBLE, 'El almacenamiento no está configurado');
  }

  const servicio = new BlobServiceClient(
    `https://${AZURE_STORAGE_CUENTA}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
  contenedorEnCache = servicio.getContainerClient(AZURE_STORAGE_CONTENEDOR);
  return contenedorEnCache;
}

// En desarrollo sin Azure se guarda en disco (D-32); en producción siempre va a Blob Storage.
async function subirArchivo(
  nombreBlob: string,
  datos: Buffer,
  tipo: string,
  mensajeError: string,
): Promise<void> {
  try {
    if (usaAlmacenamientoLocal()) {
      await guardarLocal(nombreBlob, datos);
      return;
    }
    await obtenerContenedor()
      .getBlockBlobClient(nombreBlob)
      .uploadData(datos, { blobHTTPHeaders: { blobContentType: tipo } });
  } catch (error) {
    if (error instanceof ErrorHttp) {
      throw error;
    }
    throw new ErrorHttp(CODIGO_FALLO_ALMACENAMIENTO, mensajeError, error);
  }
}

function obtenerExtension(tipo: TipoImagen): string {
  const subtipo = tipo
    .slice('image/'.length)
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return subtipo === 'jpeg' ? 'jpg' : subtipo || 'img';
}

// 5. Funciones públicas
/**
 * Valida el tamaño de una imagen y la sube al contenedor privado.
 * TEMPORAL: no se revisa el contenido real del archivo; se confía en el tipo declarado.
 * TODO(Equipo): restaurar la validación del tipo real antes del endpoint definitivo.
 *
 * @param empresaId - Id de la empresa; debe salir del token, nunca de la petición.
 * @param carpeta - Subcarpeta dentro de la empresa, por ejemplo "prueba".
 * @param datos - Bytes de la imagen.
 * @param tipo - Tipo declarado por el cliente.
 * @returns Nombre del blob, tipo y tamaño.
 * @throws ErrorHttp 400 si excede el tamaño máximo.
 * @throws ErrorHttp 502 si Azure rechaza o falla al guardar.
 */
export async function guardarImagen(
  empresaId: string,
  carpeta: string,
  datos: Buffer,
  tipo: TipoImagen,
): Promise<ArchivoGuardado> {
  const maximoBytes = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;
  if (datos.length > maximoBytes) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      `La imagen supera el máximo de ${entorno.TAMANO_MAX_EVIDENCIA_MB} MB`,
    );
  }

  // El nombre lo genera el servidor; nunca se usa el nombre que mande el cliente.
  const nombreBlob = `${empresaId}/${carpeta}/${randomUUID()}.${obtenerExtension(tipo)}`;
  await subirArchivo(nombreBlob, datos, tipo, 'No se pudo guardar la imagen en el almacenamiento');
  return { nombreBlob, tipo, tamanoBytes: datos.length };
}

/**
 * @param valor - Tipo de contenido declarado por el cliente.
 * @returns Verdadero si es un tipo de imagen (image/algo).
 */
export function esTipoImagen(valor: string): valor is TipoImagen {
  return /^image\/[a-z0-9.+-]+$/i.test(valor);
}

/**
 * Descarga una imagen del contenedor privado.
 *
 * @param nombreBlob - Nombre con el que se guardó.
 * @returns Los bytes y el tipo de la imagen.
 * @throws ErrorHttp 502 si Azure falla o la imagen no existe.
 */
export async function obtenerImagen(nombreBlob: string): Promise<{ datos: Buffer; tipo: string }> {
  if (usaAlmacenamientoLocal()) {
    try {
      return await leerLocal(nombreBlob);
    } catch (error) {
      throw new ErrorHttp(CODIGO_FALLO_ALMACENAMIENTO, 'No se pudo leer la imagen', error);
    }
  }
  const cliente = obtenerContenedor().getBlockBlobClient(nombreBlob);
  try {
    const datos = await cliente.downloadToBuffer();
    const propiedades = await cliente.getProperties();
    return { datos, tipo: propiedades.contentType ?? 'application/octet-stream' };
  } catch (error) {
    throw new ErrorHttp(CODIGO_FALLO_ALMACENAMIENTO, 'No se pudo leer la imagen', error);
  }
}

/**
 * Sube un PDF generado por el servidor (reporte o acta de una entrega). No se valida tamaño
 * porque el archivo no viene del cliente.
 *
 * @param empresaId - Id de la empresa dueña del documento.
 * @param carpeta - Subcarpeta dentro de la empresa, por ejemplo "entregas".
 * @param datos - Bytes del PDF.
 * @returns Nombre del blob, tipo y tamaño.
 * @throws ErrorHttp 502 si Azure rechaza o falla al guardar.
 */
export async function guardarPdf(
  empresaId: string,
  carpeta: string,
  datos: Buffer,
): Promise<ArchivoGuardado> {
  const nombreBlob = `${empresaId}/${carpeta}/${randomUUID()}.pdf`;
  await subirArchivo(nombreBlob, datos, TIPO_PDF, 'No se pudo guardar el documento');
  return { nombreBlob, tipo: TIPO_PDF, tamanoBytes: datos.length };
}

/**
 * Borra una imagen. Si falla no importa: solo queda un archivo huérfano.
 *
 * @param nombreBlob - Nombre con el que se guardó.
 */
export async function eliminarImagen(nombreBlob: string): Promise<void> {
  try {
    if (usaAlmacenamientoLocal()) {
      await borrarLocal(nombreBlob);
      return;
    }
    await obtenerContenedor().getBlockBlobClient(nombreBlob).deleteIfExists();
  } catch {
    // La foto nueva ya quedó guardada; no se bloquea al usuario por no borrar la vieja.
  }
}
