/**
 * @archivo servicioEntregas.ts
 * @proyecto Civil Trace
 * @descripcion Entregas al cliente: enviar un rango de fechas con sus fotos aprobadas (copia fija),
 *   listarlas para la app y para el portal.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-13 Enviar entrega al cliente, RF-67 Consultar entregas en el portal del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { EstadoAvance, EstadoEntrega } from '@/generated/prisma/enums';
import type { AccesoPortal } from '@/middleware/tokenPortal';
import { enviarEnlacePortal, type ResultadoEnlace } from '@/servicios/servicioEnlacePortal';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import {
  construirInstante,
  convertirFechaADate,
  formatearFecha,
  sumarDias,
} from '@/utilidades/fechasLocales';
import { exigirSupervisorODueno, obtenerObraDeEmpresa } from '@/utilidades/permisosObra';

// 2. Tipos e interfaces
export interface RangoEntrega {
  fechaInicio: string;
  fechaFin: string;
}

export interface ResumenEntrega {
  id: string;
  estado: EstadoEntrega;
  fechaInicio: string;
  fechaFin: string;
  enviadaEn: string;
  actividades: number;
  fotos: number;
  respondidaEn: string | null;
}

export interface EntregaApp extends ResumenEntrega {
  enviadaPor: string | null;
  nombreCliente: string | null;
  observaciones: string | null;
  tieneActa: boolean;
}

export interface EntregaEnviada extends ResumenEntrega {
  enlacePortal: ResultadoEnlace;
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
// Una foto ya enviada solo vuelve a viajar si su entrega quedó con observaciones (P-15).
const ESTADOS_QUE_OCUPAN_FOTOS = [EstadoEntrega.ENVIADA, EstadoEntrega.ACEPTADA];

const SELECCION_RESUMEN = {
  id: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  enviadaEn: true,
  respondidaEn: true,
  _count: { select: { actividades: true, avances: true } },
} as const;

// 4. Funciones privadas
interface FilaResumen {
  id: string;
  estado: EstadoEntrega;
  fechaInicio: Date;
  fechaFin: Date;
  enviadaEn: Date;
  respondidaEn: Date | null;
  _count: { actividades: number; avances: number };
}

function convertirResumen(fila: FilaResumen): ResumenEntrega {
  return {
    id: fila.id,
    estado: fila.estado,
    fechaInicio: formatearFecha(fila.fechaInicio),
    fechaFin: formatearFecha(fila.fechaFin),
    enviadaEn: fila.enviadaEn.toISOString(),
    actividades: fila._count.actividades,
    fotos: fila._count.avances,
    respondidaEn: fila.respondidaEn?.toISOString() ?? null,
  };
}

function formatearFechaCorreo(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

// 5. Funciones públicas
/**
 * Envía al cliente una entrega con las fotos aprobadas del rango que todavía no van en otra
 * entrega Enviada o Aceptada (D-29, P-15). Guarda una copia fija de las actividades y fotos, la
 * publica en el portal y avisa al cliente por correo. Si el correo falla, la entrega queda.
 *
 * @param usuario - Supervisor de la obra o dueño (sale del token).
 * @param obraId - Obra de la empresa del usuario.
 * @param rango - Fechas locales de la empresa, ya validadas.
 * @returns Resumen de la entrega y el resultado del correo.
 * @throws ErrorHttp 404 si la obra no es de la empresa; 403 sin permiso; 400 sin correo del
 *   cliente (`SIN_CORREO_CLIENTE`) o sin fotos aprobadas (`SIN_FOTOS_APROBADAS`).
 */
export async function enviarEntrega(
  usuario: DatosTokenAcceso,
  obraId: string,
  rango: RangoEntrega,
): Promise<EntregaEnviada> {
  const obraBasica = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  exigirSupervisorODueno(obraBasica, usuario);

  const obra = await prisma.obra.findUniqueOrThrow({
    where: { id: obraId },
    select: {
      id: true,
      empresaId: true,
      nombre: true,
      correoCliente: true,
      empresa: { select: { zonaHoraria: true } },
    },
  });
  if (!obra.correoCliente) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      'La obra no tiene correo del cliente',
      undefined,
      'SIN_CORREO_CLIENTE',
    );
  }

  // El rango es en fechas locales de la empresa: de las 00:00 del inicio a las 00:00 del día
  // siguiente al fin.
  const zona = obra.empresa.zonaHoraria;
  const desde = construirInstante(rango.fechaInicio, '00:00', zona);
  const hasta = construirInstante(sumarDias(rango.fechaFin, 1), '00:00', zona);

  const resumen = await prisma.$transaction(async (transaccion) => {
    const avances = await transaccion.avanceActividad.findMany({
      where: {
        empresaId: obra.empresaId,
        estado: EstadoAvance.APROBADO,
        fechaRegistro: { gte: desde, lt: hasta },
        actividad: { obraId: obra.id },
        entregas: { none: { entrega: { estado: { in: ESTADOS_QUE_OCUPAN_FOTOS } } } },
      },
      orderBy: { fechaRegistro: 'asc' },
      select: {
        id: true,
        comentario: true,
        fechaRegistro: true,
        actividad: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            estado: true,
            fechaEntrega: true,
            fechaTerminada: true,
          },
        },
      },
    });
    if (avances.length === 0) {
      throw new ErrorHttp(
        CODIGO_PETICION_INVALIDA,
        'No hay avances aprobados en ese rango de fechas',
        undefined,
        'SIN_FOTOS_APROBADAS',
      );
    }

    const entrega = await transaccion.entrega.create({
      data: {
        obraId: obra.id,
        empresaId: obra.empresaId,
        fechaInicio: convertirFechaADate(rango.fechaInicio),
        fechaFin: convertirFechaADate(rango.fechaFin),
        enviadaPorId: usuario.sub,
      },
    });

    const copiasActividad = new Map<string, string>();
    for (const avance of avances) {
      const { actividad } = avance;
      let copiaId = copiasActividad.get(actividad.id);
      if (!copiaId) {
        const copia = await transaccion.entregaActividad.create({
          data: {
            entregaId: entrega.id,
            actividadId: actividad.id,
            nombre: actividad.nombre,
            descripcion: actividad.descripcion,
            estado: actividad.estado,
            fechaEntrega: actividad.fechaEntrega,
            fechaTerminada: actividad.fechaTerminada,
          },
        });
        copiaId = copia.id;
        copiasActividad.set(actividad.id, copiaId);
      }
      await transaccion.entregaAvance.create({
        data: {
          entregaId: entrega.id,
          entregaActividadId: copiaId,
          avanceId: avance.id,
          comentario: avance.comentario,
          fechaRegistro: avance.fechaRegistro,
        },
      });
    }

    return transaccion.entrega.findUniqueOrThrow({
      where: { id: entrega.id },
      select: SELECCION_RESUMEN,
    });
  });

  const enlacePortal = await enviarEnlacePortal(obra, {
    asunto: `Nueva entrega de ${obra.nombre} para tu revisión`,
    parrafos: [
      `Tienes una nueva entrega de la obra ${obra.nombre} del ${formatearFechaCorreo(rango.fechaInicio)} al ${formatearFechaCorreo(rango.fechaFin)}.`,
      `Incluye ${resumen._count.actividades} actividades con ${resumen._count.avances} fotografías. Revísala en el portal para aceptarla o registrar tus observaciones.`,
    ],
  });

  return { ...convertirResumen(resumen), enlacePortal };
}

/**
 * Lista las entregas de una obra para la app, la más reciente primero.
 *
 * @param usuario - Supervisor de la obra o dueño.
 * @param obraId - Obra de la empresa.
 * @returns Entregas con su estado y la respuesta del cliente.
 * @throws ErrorHttp 404 si la obra no es de la empresa; 403 sin permiso.
 */
export async function listarEntregasObra(
  usuario: DatosTokenAcceso,
  obraId: string,
): Promise<EntregaApp[]> {
  const obra = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);

  const entregas = await prisma.entrega.findMany({
    where: { obraId, empresaId: usuario.empresaId },
    orderBy: { enviadaEn: 'desc' },
    select: {
      ...SELECCION_RESUMEN,
      nombreCliente: true,
      observaciones: true,
      estado: true,
      enviadaPor: { select: { nombre: true } },
    },
  });
  return entregas.map((entrega) => ({
    ...convertirResumen(entrega),
    enviadaPor: entrega.enviadaPor?.nombre ?? null,
    nombreCliente: entrega.nombreCliente,
    observaciones: entrega.observaciones,
    tieneActa: entrega.estado === EstadoEntrega.ACEPTADA,
  }));
}

/**
 * Lista las entregas de la obra del enlace para el portal, la más reciente primero (RF-67).
 *
 * @param acceso - Obra y empresa del enlace.
 * @returns Resumen de cada entrega.
 */
export async function listarEntregasPortal(acceso: AccesoPortal): Promise<ResumenEntrega[]> {
  const entregas = await prisma.entrega.findMany({
    where: { obraId: acceso.obraId, empresaId: acceso.empresaId },
    orderBy: { enviadaEn: 'desc' },
    select: SELECCION_RESUMEN,
  });
  return entregas.map(convertirResumen);
}
