/**
 * @archivo servicioAlmacenamiento.ts
 * @proyecto Civil Trace
 * @descripcion Guarda imágenes en el contenedor privado de Azure Blob Storage, usando la
 * identidad administrada del App Service (sin claves ni cadenas de conexión).
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 18/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { randomUUID } from 'node:crypto';

import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';

import { entorno } from '@/configuracion/entorno';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export type TipoImagen = 'image/jpeg' | 'image/png';

export interface ArchivoGuardado {
  nombreBlob: string;
  tipo: TipoImagen;
  tamanoBytes: number;
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_FALLO_ALMACENAMIENTO = 502;
const CODIGO_NO_DISPONIBLE = 503;
const BYTES_POR_MEGABYTE = 1024 * 1024;
const FIRMA_JPEG = [0xff, 0xd8, 0xff];
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const EXTENSION_POR_TIPO: Record<TipoImagen, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

let contenedorEnCache: ContainerClient | null = null;

// 4. Funciones privadas
function empiezaCon(datos: Buffer, firma: number[]): boolean {
  return firma.every((byte, indice) => datos[indice] === byte);
}

// Se lee el contenido real del archivo: el tipo que declara el cliente no es de fiar.
function detectarTipoImagen(datos: Buffer): TipoImagen | null {
  if (empiezaCon(datos, FIRMA_JPEG)) {
    return 'image/jpeg';
  }
  if (empiezaCon(datos, FIRMA_PNG)) {
    return 'image/png';
  }
  return null;
}

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

// 5. Funciones públicas
/**
 * Valida una imagen (tipo real y tamaño) y la sube al contenedor privado.
 *
 * @param empresaId - Id de la empresa; debe salir del token, nunca de la petición.
 * @param carpeta - Subcarpeta dentro de la empresa, por ejemplo "prueba".
 * @param datos - Bytes de la imagen.
 * @returns Nombre del blob, tipo detectado y tamaño.
 * @throws ErrorHttp 400 si no es JPEG o PNG, o si excede el tamaño máximo.
 * @throws ErrorHttp 502 si Azure rechaza o falla al guardar.
 */
export async function guardarImagen(
  empresaId: string,
  carpeta: string,
  datos: Buffer,
): Promise<ArchivoGuardado> {
  const tipo = detectarTipoImagen(datos);
  if (!tipo) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'El archivo no es una imagen JPEG o PNG válida');
  }

  const maximoBytes = entorno.TAMANO_MAX_EVIDENCIA_MB * BYTES_POR_MEGABYTE;
  if (datos.length > maximoBytes) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      `La imagen supera el máximo de ${entorno.TAMANO_MAX_EVIDENCIA_MB} MB`,
    );
  }

  const contenedor = obtenerContenedor();
  // El nombre lo genera el servidor; nunca se usa el nombre que mande el cliente.
  const nombreBlob = `${empresaId}/${carpeta}/${randomUUID()}.${EXTENSION_POR_TIPO[tipo]}`;

  try {
    await contenedor
      .getBlockBlobClient(nombreBlob)
      .uploadData(datos, { blobHTTPHeaders: { blobContentType: tipo } });
  } catch (error) {
    throw new ErrorHttp(
      CODIGO_FALLO_ALMACENAMIENTO,
      'No se pudo guardar la imagen en el almacenamiento',
      error,
    );
  }

  return { nombreBlob, tipo, tamanoBytes: datos.length };
}
