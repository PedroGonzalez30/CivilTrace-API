/**
 * @archivo servicioPerfil.ts
 * @proyecto Civil Trace
 * @descripcion Lógica del perfil del usuario: consultar, actualizar y manejar la foto.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import type { DatosActualizarPerfil } from '@/esquemas/esquemasPerfil';
import { Prisma } from '@/generated/prisma/client';
import {
  eliminarImagen,
  guardarImagen,
  obtenerImagen,
  type TipoImagen,
} from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface PerfilPublico {
  nombre: string;
  correo: string;
  telefono: string | null;
  tieneFoto: boolean;
}

interface FilaPerfil {
  nombre: string;
  correo: string;
  telefono: string | null;
  fotoBlob: string | null;
}

// 3. Constantes del módulo
const CODIGO_NO_AUTORIZADO = 401;
const CODIGO_NO_ENCONTRADO = 404;
const CODIGO_CONFLICTO = 409;
const CODIGO_PRISMA_VIOLACION_UNICA = 'P2002';
const CARPETA_PERFILES = 'perfiles';
const SELECCION_PERFIL = { nombre: true, correo: true, telefono: true, fotoBlob: true } as const;

// 4. Funciones privadas
function aPerfil(fila: FilaPerfil): PerfilPublico {
  return {
    nombre: fila.nombre,
    correo: fila.correo,
    telefono: fila.telefono,
    tieneFoto: fila.fotoBlob !== null,
  };
}

async function buscarFila(usuarioId: string): Promise<FilaPerfil> {
  const fila = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: SELECCION_PERFIL,
  });
  if (!fila) {
    throw new ErrorHttp(CODIGO_NO_AUTORIZADO, 'Sesión no válida o expirada');
  }
  return fila;
}

// 5. Funciones públicas
/**
 * @param usuarioId - Id del usuario (viene del token de acceso).
 * @returns Datos del perfil del usuario.
 * @throws ErrorHttp 401 si el usuario ya no existe.
 */
export async function obtenerPerfil(usuarioId: string): Promise<PerfilPublico> {
  return aPerfil(await buscarFila(usuarioId));
}

/**
 * Actualiza nombre, correo y teléfono del usuario.
 *
 * @param usuarioId - Id del usuario (viene del token de acceso).
 * @param datos - Datos ya validados.
 * @returns El perfil actualizado.
 * @throws ErrorHttp 409 si el correo ya lo usa otra cuenta.
 */
export async function actualizarPerfil(
  usuarioId: string,
  datos: DatosActualizarPerfil,
): Promise<PerfilPublico> {
  try {
    const fila = await prisma.usuario.update({
      where: { id: usuarioId },
      data: { nombre: datos.nombre, correo: datos.correo, telefono: datos.telefono },
      select: SELECCION_PERFIL,
    });
    return aPerfil(fila);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === CODIGO_PRISMA_VIOLACION_UNICA
    ) {
      throw new ErrorHttp(CODIGO_CONFLICTO, 'Este correo ya está registrado');
    }
    throw error;
  }
}

/**
 * Guarda la foto de perfil y borra la anterior.
 *
 * @param usuarioId - Id del usuario.
 * @param empresaId - Id de la empresa (sale del token, nunca de la petición).
 * @param datos - Bytes de la imagen.
 * @param tipo - Tipo de la imagen (image/algo).
 * @throws ErrorHttp 400 si excede el tamaño máximo; 502 si Azure falla.
 */
export async function guardarFotoPerfil(
  usuarioId: string,
  empresaId: string,
  datos: Buffer,
  tipo: TipoImagen,
): Promise<void> {
  const anterior = (await buscarFila(usuarioId)).fotoBlob;
  const archivo = await guardarImagen(empresaId, CARPETA_PERFILES, datos, tipo);
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { fotoBlob: archivo.nombreBlob },
  });
  if (anterior) {
    await eliminarImagen(anterior);
  }
}

/**
 * @param usuarioId - Id del usuario.
 * @returns Los bytes y el tipo de su foto de perfil.
 * @throws ErrorHttp 404 si no tiene foto.
 */
export async function obtenerFotoPerfil(
  usuarioId: string,
): Promise<{ datos: Buffer; tipo: string }> {
  const { fotoBlob } = await buscarFila(usuarioId);
  if (!fotoBlob) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'No tienes foto de perfil');
  }
  return obtenerImagen(fotoBlob);
}