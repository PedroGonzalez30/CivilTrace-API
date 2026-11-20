/**
 * @archivo servicioReportes.ts
 * @proyecto Civil Trace
 * @descripcion Consulta el historial completo de actividades y avances de una obra para reportes
 *              y vista previa, filtrado por empresaId y rango de fechas opcional.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

import { prisma } from '@/baseDatos/clientePrisma';
import { EstadoActividad, EstadoAvance } from '@/generated/prisma/enums';
import { ErrorHttp } from '@/utilidades/errores';

export interface AvanceReporteRespuesta {
  id: string;
  comentario: string;
  estado: EstadoAvance;
  fechaRegistro: string;
  registradoPor: string | null;
  tieneFoto: boolean;
}

export interface ActividadReporteRespuesta {
  id: string;
  nombre: string;
  estado: EstadoActividad;
  fechaEntrega: string;
  fechaTerminada: string | null;
  responsable: string | null;
  supervisor: string | null;
  avances: AvanceReporteRespuesta[];
}

export interface ReporteObraRespuesta {
  obra: {
    id: string;
    nombre: string;
    cliente: string | null;
    direccion: string;
    fechaInicio: string;
    fechaFinal: string;
    supervisor: string | null;
  };
  actividades: ActividadReporteRespuesta[];
}

const CODIGO_NO_ENCONTRADO = 404;
const LARGO_FECHA_ISO = 10;

export async function obtenerReporteObra(
  empresaId: string,
  idObra: string,
  fechaInicio?: string,
  fechaFin?: string,
): Promise<ReporteObraRespuesta> {
  const obra = await prisma.obra.findFirst({
    where: { id: idObra, empresaId },
    select: {
      id: true,
      nombre: true,
      cliente: true,
      direccion: true,
      fechaInicio: true,
      fechaFinal: true,
      supervisor: { select: { nombre: true } },
    },
  });

  if (!obra) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Obra no encontrada');
  }

  const filtroFecha: { gte?: Date; lte?: Date } = {};
  if (fechaInicio) {
    filtroFecha.gte = new Date(`${fechaInicio}T00:00:00.000Z`);
  }
  if (fechaFin) {
    filtroFecha.lte = new Date(`${fechaFin}T23:59:59.999Z`);
  }

  const actividades = await prisma.actividad.findMany({
    where: { empresaId, obraId: idObra },
    select: {
      id: true,
      nombre: true,
      estado: true,
      fechaEntrega: true,
      fechaTerminada: true,
      responsable: { select: { nombre: true } },
      obra: { select: { supervisor: { select: { nombre: true } } } },
      avances: {
        where: Object.keys(filtroFecha).length > 0 ? { fechaRegistro: filtroFecha } : undefined,
        select: {
          id: true,
          comentario: true,
          estado: true,
          fechaRegistro: true,
          registradoPor: { select: { nombre: true } },
        },
        orderBy: { fechaRegistro: 'asc' },
      },
    },
    orderBy: [{ fechaEntrega: 'asc' }, { creadaEn: 'desc' }],
  });

  const tieneFiltroFechas = Boolean(fechaInicio || fechaFin);
  const actividadesMapeadas: ActividadReporteRespuesta[] = actividades
    .filter((act) => !tieneFiltroFechas || act.avances.length > 0)
    .map((act) => ({
      id: act.id,
      nombre: act.nombre,
      estado: act.estado,
      fechaEntrega: act.fechaEntrega.toISOString().slice(0, LARGO_FECHA_ISO),
      fechaTerminada: act.fechaTerminada
        ? act.fechaTerminada.toISOString().slice(0, LARGO_FECHA_ISO)
        : null,
      responsable: act.responsable?.nombre ?? null,
      supervisor: act.obra.supervisor?.nombre ?? null,
      avances: act.avances.map((av) => ({
        id: av.id,
        comentario: av.comentario,
        estado: av.estado,
        fechaRegistro: av.fechaRegistro.toISOString(),
        registradoPor: av.registradoPor?.nombre ?? null,
        tieneFoto: true,
      })),
    }));

  return {
    obra: {
      id: obra.id,
      nombre: obra.nombre,
      cliente: obra.cliente,
      direccion: obra.direccion,
      fechaInicio: obra.fechaInicio.toISOString().slice(0, LARGO_FECHA_ISO),
      fechaFinal: obra.fechaFinal.toISOString().slice(0, LARGO_FECHA_ISO),
      supervisor: obra.supervisor?.nombre ?? null,
    },
    actividades: actividadesMapeadas,
  };
}
