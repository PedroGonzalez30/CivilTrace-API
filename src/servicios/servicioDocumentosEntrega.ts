/**
 * @archivo servicioDocumentosEntrega.ts
 * @proyecto Civil Trace
 * @descripcion Reporte y acta en PDF de una entrega: reúne los datos de la copia fija, genera el
 *   archivo una sola vez y lo guarda en Blob Storage para que la app y el portal descarguen el mismo
 *   archivo. También bloquea las actividades terminadas de entregas aceptadas.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.1.0
 * @requerimientos RF-12 Generar reporte de avance de obra, RF-16 Generar acta de
 *   entrega-recepción, RF-17 Bloquear entrega aceptada, RF-71 Descargar documentos de una entrega
 *   en el portal
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 *   25/11/2026 - Emilio Manuel Esquivel - Ubicación de cada foto (feature 007, RF-08)
 */

// 1. Importaciones
import { createHash } from 'node:crypto';

import { prisma } from '@/baseDatos/clientePrisma';
import { CARPETA_ENTREGAS } from '@/constantes/portal';
import { EstadoActividad, EstadoEntrega } from '@/generated/prisma/enums';
import { guardarPdf, obtenerImagen } from '@/servicios/servicioAlmacenamiento';
import {
  generarActaEntrega,
  generarReporteEntrega,
  type DatosDocumentoEntrega,
} from '@/servicios/servicioPdf';
import { ErrorHttp } from '@/utilidades/errores';
import { formatearFecha } from '@/utilidades/fechasLocales';
import { describirUbicacion, SELECCION_UBICACION } from '@/utilidades/ubicacionEvidencia';

// 2. Tipos e interfaces
/** Obra y empresa a las que debe pertenecer la entrega (del token de la app o del enlace). */
export interface AlcanceEntrega {
  obraId: string;
  empresaId: string;
}

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
const CODIGO_CONFLICTO = 409;
const NOMBRES_ESTADO: Record<EstadoActividad, string> = {
  [EstadoActividad.ACTIVA]: 'En curso',
  [EstadoActividad.TERMINADA]: 'Verificada',
};

// 4. Funciones privadas
function formatearFechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(instante: Date, zona: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: zona,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(instante);
}

// Una imagen que no se puede leer no detiene el documento: el PDF muestra un aviso en su lugar.
async function leerImagenOpcional(nombreBlob: string | null): Promise<Buffer | null> {
  if (!nombreBlob) {
    return null;
  }
  try {
    return (await obtenerImagen(nombreBlob)).datos;
  } catch {
    return null;
  }
}

async function buscarEntrega(alcance: AlcanceEntrega, entregaId: string) {
  const entrega = await prisma.entrega.findFirst({
    where: { id: entregaId, obraId: alcance.obraId, empresaId: alcance.empresaId },
    include: {
      obra: {
        select: {
          nombre: true,
          cliente: true,
          direccion: true,
          empresa: { select: { nombre: true, zonaHoraria: true } },
        },
      },
      actividades: {
        orderBy: { fechaEntrega: 'asc' },
        include: {
          avances: {
            orderBy: { fechaRegistro: 'asc' },
            include: { avance: { select: { fotoBlob: true, ...SELECCION_UBICACION } } },
          },
        },
      },
    },
  });
  if (!entrega) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Entrega no encontrada');
  }
  return entrega;
}

type EntregaCompleta = Awaited<ReturnType<typeof buscarEntrega>>;

async function reunirDatos(entrega: EntregaCompleta): Promise<DatosDocumentoEntrega> {
  const zona = entrega.obra.empresa.zonaHoraria;
  const actividades = [];
  for (const actividad of entrega.actividades) {
    const fotos = [];
    for (const foto of actividad.avances) {
      fotos.push({
        comentario: foto.comentario,
        fechaHora: formatearFechaHora(foto.fechaRegistro, zona),
        ubicacion: describirUbicacion(foto.avance),
        imagen: await leerImagenOpcional(foto.avance.fotoBlob),
      });
    }
    actividades.push({
      nombre: actividad.nombre,
      descripcion: actividad.descripcion,
      estado: NOMBRES_ESTADO[actividad.estado],
      fechaEntrega: formatearFechaLegible(formatearFecha(actividad.fechaEntrega)),
      fotos,
    });
  }
  return {
    empresa: entrega.obra.empresa.nombre,
    obra: entrega.obra.nombre,
    cliente: entrega.obra.cliente,
    direccion: entrega.obra.direccion,
    periodo: `${formatearFechaLegible(formatearFecha(entrega.fechaInicio))} al ${formatearFechaLegible(formatearFecha(entrega.fechaFin))}`,
    enviadaEn: formatearFechaHora(entrega.enviadaEn, zona),
    actividades,
  };
}

// 5. Funciones públicas
/**
 * Devuelve el reporte de avance de la entrega; lo genera y guarda la primera vez (RF-12, RF-71).
 *
 * @param alcance - Obra y empresa permitidas.
 * @param entregaId - Entrega de esa obra.
 * @returns Bytes del PDF.
 * @throws ErrorHttp 404 si la entrega no es de la obra.
 */
export async function obtenerReportePdf(
  alcance: AlcanceEntrega,
  entregaId: string,
): Promise<Buffer> {
  const entrega = await buscarEntrega(alcance, entregaId);
  if (entrega.reporteBlob) {
    return (await obtenerImagen(entrega.reporteBlob)).datos;
  }
  const pdf = await generarReporteEntrega(await reunirDatos(entrega));
  const archivo = await guardarPdf(alcance.empresaId, CARPETA_ENTREGAS, pdf);
  await prisma.entrega.update({
    where: { id: entrega.id },
    data: { reporteBlob: archivo.nombreBlob },
  });
  return pdf;
}

/**
 * Devuelve el acta de entrega-recepción; la genera y guarda la primera vez con su SHA-256
 * (RF-16). Solo existe para entregas aceptadas.
 *
 * @param alcance - Obra y empresa permitidas.
 * @param entregaId - Entrega de esa obra.
 * @returns Bytes del PDF.
 * @throws ErrorHttp 404 si la entrega no es de la obra; 409 `ENTREGA_NO_ACEPTADA`.
 */
export async function obtenerActaPdf(alcance: AlcanceEntrega, entregaId: string): Promise<Buffer> {
  const entrega = await buscarEntrega(alcance, entregaId);
  if (entrega.estado !== EstadoEntrega.ACEPTADA || !entrega.respondidaEn) {
    throw new ErrorHttp(
      CODIGO_CONFLICTO,
      'El acta se genera al aceptar la entrega',
      undefined,
      'ENTREGA_NO_ACEPTADA',
    );
  }
  if (entrega.actaBlob) {
    return (await obtenerImagen(entrega.actaBlob)).datos;
  }

  const datos = await reunirDatos(entrega);
  const pdf = await generarActaEntrega({
    ...datos,
    aceptacion: {
      nombreCliente: entrega.nombreCliente ?? '',
      fechaHora: formatearFechaHora(entrega.respondidaEn, entrega.obra.empresa.zonaHoraria),
      firma: await leerImagenOpcional(entrega.firmaBlob),
      firmaSha256: entrega.firmaSha256 ?? '',
    },
  });
  const archivo = await guardarPdf(alcance.empresaId, CARPETA_ENTREGAS, pdf);
  await prisma.entrega.update({
    where: { id: entrega.id },
    data: {
      actaBlob: archivo.nombreBlob,
      actaSha256: createHash('sha256').update(pdf).digest('hex'),
    },
  });
  return pdf;
}

/**
 * Indica si una actividad está bloqueada por RF-17: terminada y dentro de una entrega aceptada.
 * Las actividades en curso de una entrega parcial aceptada siguen recibiendo avances (D-31).
 *
 * @param actividadId - Actividad a revisar.
 * @returns true si no se puede modificar.
 */
export async function estaActividadBloqueada(actividadId: string): Promise<boolean> {
  const coincidencias = await prisma.entregaActividad.count({
    where: {
      actividadId,
      actividad: { estado: EstadoActividad.TERMINADA },
      entrega: { estado: EstadoEntrega.ACEPTADA },
    },
  });
  return coincidencias > 0;
}

/**
 * @param actividadId - Actividad que se quiere modificar.
 * @throws ErrorHttp 409 `ENTREGA_ACEPTADA` si está bloqueada (RF-17).
 */
export async function exigirActividadNoBloqueada(actividadId: string): Promise<void> {
  if (await estaActividadBloqueada(actividadId)) {
    throw new ErrorHttp(
      CODIGO_CONFLICTO,
      'La actividad forma parte de una entrega aceptada y no se puede modificar',
      undefined,
      'ENTREGA_ACEPTADA',
    );
  }
}
