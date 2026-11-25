/**
 * @archivo servicioPortal.ts
 * @proyecto Civil Trace
 * @descripcion Consultas de solo lectura del portal web del cliente: datos de la obra, avances con
 *   fotos aprobadas y las fotos mismas. Todo se filtra por la obra y la empresa del enlace.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-65 Enviar enlace del portal al cliente, RF-66 Consultar avances en el portal
 *   del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { EstadoAvance, type EstadoActividad } from '@/generated/prisma/enums';
import type { AccesoPortal } from '@/middleware/tokenPortal';
import { obtenerImagen } from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';
import { formatearFecha } from '@/utilidades/fechasLocales';

// 2. Tipos e interfaces
export interface ObraPortal {
  nombre: string;
  cliente: string | null;
  direccion: string;
  fechaInicio: string;
  fechaFinal: string;
  empresa: { nombre: string; tieneLogo: boolean };
}

export interface FotoPortal {
  id: string;
  comentario: string;
  fechaRegistro: string;
  // La app aún no captura la ubicación (P-16); el portal la muestra cuando exista.
  ubicacion: null;
}

export interface ActividadPortal {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoActividad;
  fechaEntrega: string;
  fechaTerminada: string | null;
  fotos: FotoPortal[];
}

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
const MENSAJE_FOTO_NO_ENCONTRADA = 'Fotografía no encontrada';

// 4. Funciones
/**
 * @param acceso - Obra y empresa del enlace.
 * @returns Los datos de la obra que ve el cliente (sin supervisor, trabajadores ni códigos).
 * @throws ErrorHttp 404 si la obra ya no existe.
 */
export async function obtenerObraPortal(acceso: AccesoPortal): Promise<ObraPortal> {
  const obra = await prisma.obra.findFirst({
    where: { id: acceso.obraId, empresaId: acceso.empresaId },
    select: {
      nombre: true,
      cliente: true,
      direccion: true,
      fechaInicio: true,
      fechaFinal: true,
      empresa: { select: { nombre: true, logoBlob: true } },
    },
  });
  if (!obra) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Obra no encontrada');
  }
  return {
    nombre: obra.nombre,
    cliente: obra.cliente,
    direccion: obra.direccion,
    fechaInicio: formatearFecha(obra.fechaInicio),
    fechaFinal: formatearFecha(obra.fechaFinal),
    empresa: { nombre: obra.empresa.nombre, tieneLogo: obra.empresa.logoBlob !== null },
  };
}

/**
 * Actividades de la obra con su estado y solo las fotos aprobadas, ordenadas por fecha (RF-66).
 * Las fotos pendientes o rechazadas nunca salen del servidor (D-10).
 *
 * @param acceso - Obra y empresa del enlace.
 * @returns Actividades con fotos; las que aún no tienen fotos aprobadas también aparecen.
 */
export async function listarAvancesPortal(acceso: AccesoPortal): Promise<ActividadPortal[]> {
  const actividades = await prisma.actividad.findMany({
    where: { obraId: acceso.obraId, empresaId: acceso.empresaId },
    orderBy: [{ fechaEntrega: 'asc' }, { creadaEn: 'asc' }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      estado: true,
      fechaEntrega: true,
      fechaTerminada: true,
      avances: {
        where: { estado: EstadoAvance.APROBADO },
        orderBy: { fechaRegistro: 'asc' },
        select: { id: true, comentario: true, fechaRegistro: true },
      },
    },
  });

  return actividades.map((actividad) => ({
    id: actividad.id,
    nombre: actividad.nombre,
    descripcion: actividad.descripcion,
    estado: actividad.estado,
    fechaEntrega: formatearFecha(actividad.fechaEntrega),
    fechaTerminada: actividad.fechaTerminada ? formatearFecha(actividad.fechaTerminada) : null,
    fotos: actividad.avances.map((avance) => ({
      id: avance.id,
      comentario: avance.comentario,
      fechaRegistro: avance.fechaRegistro.toISOString(),
      ubicacion: null,
    })),
  }));
}

/**
 * Descarga una foto aprobada de la obra del enlace o una que va en alguna de sus entregas.
 *
 * @param acceso - Obra y empresa del enlace.
 * @param avanceId - Id del avance.
 * @returns Bytes y tipo de la imagen.
 * @throws ErrorHttp 404 si no es una foto aprobada de esa obra.
 */
export async function obtenerFotoPortal(
  acceso: AccesoPortal,
  avanceId: string,
): Promise<{ datos: Buffer; tipo: string }> {
  const avance = await prisma.avanceActividad.findFirst({
    where: {
      id: avanceId,
      empresaId: acceso.empresaId,
      actividad: { obraId: acceso.obraId },
      // Una foto enviada en una entrega se sigue viendo en ella aunque después cambie (R-06).
      OR: [{ estado: EstadoAvance.APROBADO }, { entregas: { some: {} } }],
    },
    select: { fotoBlob: true },
  });
  if (!avance) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_FOTO_NO_ENCONTRADA);
  }
  return obtenerImagen(avance.fotoBlob);
}
