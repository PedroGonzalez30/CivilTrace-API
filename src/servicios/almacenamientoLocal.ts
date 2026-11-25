/**
 * @archivo almacenamientoLocal.ts
 * @proyecto Civil Trace
 * @descripcion Almacenamiento en disco SOLO para desarrollo local: si la API corre con
 *   NODE_ENV=development y sin Azure Blob Storage configurado, fotos, firmas y PDF se guardan en la
 *   carpeta almacenamiento-local/ (ignorada por Git). En producción nunca se usa.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica (pruebas locales del feature 004)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (D-32)
 */

// 1. Importaciones
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { entorno } from '@/configuracion/entorno';

// 3. Constantes del módulo
const CARPETA_RAIZ = resolve(process.cwd(), 'almacenamiento-local');
const TIPOS_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

// 4. Funciones
/**
 * @returns true solo en desarrollo y sin Azure Blob Storage configurado.
 */
export function usaAlmacenamientoLocal(): boolean {
  return entorno.NODE_ENV === 'development' && !entorno.AZURE_STORAGE_CUENTA;
}

// El nombre lo genera el servidor, pero se revisa que no salga de la carpeta por si acaso.
function obtenerRuta(nombreBlob: string): string {
  const ruta = resolve(join(CARPETA_RAIZ, nombreBlob));
  if (!ruta.startsWith(CARPETA_RAIZ + sep)) {
    throw new Error('Nombre de archivo inválido');
  }
  return ruta;
}

/** Guarda un archivo en la carpeta local. */
export async function guardarLocal(nombreBlob: string, datos: Buffer): Promise<void> {
  const ruta = obtenerRuta(nombreBlob);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, datos);
}

/** Lee un archivo de la carpeta local; el tipo sale de la extensión. */
export async function leerLocal(nombreBlob: string): Promise<{ datos: Buffer; tipo: string }> {
  const datos = await readFile(obtenerRuta(nombreBlob));
  const extension = nombreBlob.split('.').pop()?.toLowerCase() ?? '';
  return { datos, tipo: TIPOS_POR_EXTENSION[extension] ?? 'application/octet-stream' };
}

/** Borra un archivo de la carpeta local; si no existe no pasa nada. */
export async function borrarLocal(nombreBlob: string): Promise<void> {
  await rm(obtenerRuta(nombreBlob), { force: true });
}
