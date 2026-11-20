/**
 * @archivo servicioEmpresa.ts
 * @proyecto Civil Trace
 * @descripcion Lógica de consulta de los datos de la empresa del usuario.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { Rol } from '@/generated/prisma/enums';
import { ErrorHttp } from '@/utilidades/errores';
import { generarCodigoAcceso } from '@/utilidades/codigosAcceso';
import type { DatosActualizarEmpresa } from '@/esquemas/esquemasEmpresa';
import {
  eliminarImagen,
  guardarImagen,
  obtenerImagen,
  type TipoImagen,
} from '@/servicios/servicioAlmacenamiento';

// 2. Tipos e interfaces
export interface CodigosEmpresa {
  trabajadores: string;
  supervisores: string;
}
export type TipoCodigoEmpresa = 'trabajadores' | 'supervisores';

export interface PersonaEmpresa {
  id: string;
  nombre: string;
}

export interface PersonalEmpresa {
  supervisores: PersonaEmpresa[];
  trabajadores: PersonaEmpresa[];
}

export interface DatosEmpresa {
  nombre: string;
  correo: string | null;
  descripcion: string | null;
  direccion: string | null;
  tieneLogo: boolean;
}

interface FilaDatosEmpresa {
  nombre: string;
  correo: string | null;
  descripcion: string | null;
  direccion: string | null;
  logoBlob: string | null;
}

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
const MENSAJE_EMPRESA_NO_ENCONTRADA = 'Empresa no encontrada';
const CARPETA_LOGOS = 'logos';
const SELECCION_DATOS = {
  nombre: true,
  correo: true,
  descripcion: true,
  direccion: true,
  logoBlob: true,
} as const;

// 4. Funciones privadas
function aDatosEmpresa(fila: FilaDatosEmpresa): DatosEmpresa {
  return {
    nombre: fila.nombre,
    correo: fila.correo,
    descripcion: fila.descripcion,
    direccion: fila.direccion,
    tieneLogo: fila.logoBlob !== null,
  };
}

async function buscarFilaEmpresa(empresaId: string): Promise<FilaDatosEmpresa> {
  const fila = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: SELECCION_DATOS,
  });
  if (!fila) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_EMPRESA_NO_ENCONTRADA);
  }
  return fila;
}

// 5. Funciones públicas
/**
 * Devuelve los códigos de acceso de una empresa. El empresaId debe salir del token,
 * nunca de lo que mande el cliente.
 *
 * @param empresaId - Id de la empresa del usuario autenticado.
 * @returns Los códigos para unir trabajadores y supervisores.
 * @throws ErrorHttp 404 si la empresa ya no existe.
 */
export async function obtenerCodigosEmpresa(empresaId: string): Promise<CodigosEmpresa> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { codigoTrabajadores: true, codigoSupervisores: true },
  });
  if (!empresa) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_EMPRESA_NO_ENCONTRADA);
  }
  return {
    trabajadores: empresa.codigoTrabajadores,
    supervisores: empresa.codigoSupervisores,
  };
}

/**
 * Reemplaza uno de los códigos de acceso por uno nuevo. El otro código no cambia.
 *
 * @param empresaId - Id de la empresa del usuario autenticado (sale del token).
 * @param tipo - Código a regenerar.
 * @returns Los dos códigos ya actualizados.
 * @throws ErrorHttp 404 si la empresa ya no existe.
 */
export async function regenerarCodigoEmpresa(
  empresaId: string,
  tipo: TipoCodigoEmpresa,
): Promise<CodigosEmpresa> {
  const codigoNuevo = generarCodigoAcceso();
  const datos =
    tipo === 'supervisores'
      ? { codigoSupervisores: codigoNuevo }
      : { codigoTrabajadores: codigoNuevo };

  const { count } = await prisma.empresa.updateMany({ where: { id: empresaId }, data: datos });
  if (count === 0) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_EMPRESA_NO_ENCONTRADA);
  }
  return obtenerCodigosEmpresa(empresaId);
}

/**
 * Lista los supervisores y trabajadores de la empresa. Solo se leen id y nombre: nunca el
 * correo ni la contraseña.
 *
 * @param empresaId - Id de la empresa del usuario autenticado (sale del token).
 * @returns Supervisores y trabajadores, ordenados por nombre.
 */
export async function obtenerPersonalEmpresa(empresaId: string): Promise<PersonalEmpresa> {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId, rol: { in: [Rol.SUPERVISOR, Rol.TRABAJADOR] } },
    select: { id: true, nombre: true, rol: true },
    orderBy: { nombre: 'asc' },
  });

  const aPersona = ({ id, nombre }: { id: string; nombre: string }): PersonaEmpresa => ({
    id,
    nombre,
  });

  return {
    supervisores: usuarios.filter((usuario) => usuario.rol === Rol.SUPERVISOR).map(aPersona),
    trabajadores: usuarios.filter((usuario) => usuario.rol === Rol.TRABAJADOR).map(aPersona),
  };
}

/**
 * Saca a un supervisor o trabajador de la empresa SIN borrar su cuenta. Filtra por empresaId
 * (que sale del token) y por rol, así el dueño no puede sacarse a sí mismo ni a personal ajeno.
 * Sus obras como supervisor quedan sin supervisor, sale de las obras donde era trabajador y
 * sus sesiones se cierran.
 *
 * @param empresaId - Id de la empresa del usuario autenticado.
 * @param idPersona - Id de la persona a sacar de la empresa.
 * @throws ErrorHttp 404 si no existe en esa empresa o no es supervisor/trabajador.
 */
export async function eliminarPersonalEmpresa(
  empresaId: string,
  idPersona: string,
): Promise<void> {
  await prisma.$transaction(async (transaccion) => {
    const persona = await transaccion.usuario.findFirst({
      where: { id: idPersona, empresaId, rol: { in: [Rol.SUPERVISOR, Rol.TRABAJADOR] } },
      select: { id: true },
    });
    if (!persona) {
      throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Persona no encontrada');
    }

    // Las obras que supervisaba se conservan, pero sin supervisor.
    await transaccion.obra.updateMany({
      where: { supervisorId: persona.id },
      data: { supervisorId: null },
    });

    // Sale de la empresa y de las obras donde estaba como trabajador. La cuenta se conserva.
    await transaccion.usuario.update({
      where: { id: persona.id },
      data: { empresaId: null, obrasAsignadas: { set: [] } },
    });

    // Cierra todas sus sesiones abiertas.
    await transaccion.tokenRefresco.updateMany({
      where: { usuarioId: persona.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  });
}

/**
 * @param empresaId - Id de la empresa del usuario autenticado (sale del token).
 * @returns Los datos de la empresa.
 * @throws ErrorHttp 404 si la empresa ya no existe.
 */
export async function obtenerDatosEmpresa(empresaId: string): Promise<DatosEmpresa> {
  return aDatosEmpresa(await buscarFilaEmpresa(empresaId));
}

/**
 * Actualiza nombre, correo, descripción y dirección de la empresa.
 *
 * @param empresaId - Id de la empresa del usuario autenticado (sale del token).
 * @param datos - Datos ya validados.
 * @returns Los datos actualizados.
 * @throws ErrorHttp 404 si la empresa ya no existe.
 */
export async function actualizarDatosEmpresa(
  empresaId: string,
  datos: DatosActualizarEmpresa,
): Promise<DatosEmpresa> {
  await buscarFilaEmpresa(empresaId);
  const fila = await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      nombre: datos.nombre,
      correo: datos.correo,
      descripcion: datos.descripcion,
      direccion: datos.direccion,
    },
    select: SELECCION_DATOS,
  });
  return aDatosEmpresa(fila);
}

/**
 * Guarda el logotipo de la empresa y borra el anterior.
 *
 * @param empresaId - Id de la empresa (sale del token, nunca de la petición).
 * @param datos - Bytes de la imagen.
 * @param tipo - Tipo de la imagen (image/algo).
 * @throws ErrorHttp 400 si excede el tamaño máximo; 502 si Azure falla.
 */
export async function guardarLogoEmpresa(
  empresaId: string,
  datos: Buffer,
  tipo: TipoImagen,
): Promise<void> {
  const anterior = (await buscarFilaEmpresa(empresaId)).logoBlob;
  const archivo = await guardarImagen(empresaId, CARPETA_LOGOS, datos, tipo);
  await prisma.empresa.update({
    where: { id: empresaId },
    data: { logoBlob: archivo.nombreBlob },
  });
  if (anterior) {
    await eliminarImagen(anterior);
  }
}

/**
 * @param empresaId - Id de la empresa del usuario autenticado.
 * @returns Los bytes y el tipo del logotipo.
 * @throws ErrorHttp 404 si la empresa no tiene logotipo.
 */
export async function obtenerLogoEmpresa(
  empresaId: string,
): Promise<{ datos: Buffer; tipo: string }> {
  const { logoBlob } = await buscarFilaEmpresa(empresaId);
  if (!logoBlob) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'La empresa no tiene logotipo');
  }
  return obtenerImagen(logoBlob);
}
