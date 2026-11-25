/**
 * @archivo servicioRespuestaCliente.ts
 * @proyecto Civil Trace
 * @descripcion Lo que el cliente hace con una entrega desde el portal: ver su detalle, pedir el
 *   código, aceptarla con nombre y firma, registrar observaciones y consultar la firma guardada.
 * @autor Emilio Manuel Esquivel
 * @fecha 24/11/2026
 * @version 1.0.0
 * @requerimientos RF-14 Registrar aceptación de entrega, RF-60 Firmar aceptación de entrega,
 *   RF-67 Consultar entregas en el portal del cliente, RF-15 Registrar observaciones del cliente
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Creación (feature 004)
 */

// 1. Importaciones
import { createHash } from 'node:crypto';

import { prisma } from '@/baseDatos/clientePrisma';
import { CARPETA_FIRMAS, TAMANO_MAXIMO_FIRMA_BYTES } from '@/constantes/portal';
import { EstadoEntrega, type EstadoActividad } from '@/generated/prisma/enums';
import type { AccesoPortal } from '@/middleware/tokenPortal';
import { eliminarImagen, guardarImagen, obtenerImagen } from '@/servicios/servicioAlmacenamiento';
import {
  marcarCodigoUsado,
  solicitarCodigo,
  verificarCodigo,
  type CodigoSolicitado,
} from '@/servicios/servicioCodigoEntrega';
import { ErrorHttp } from '@/utilidades/errores';
import { formatearFecha } from '@/utilidades/fechasLocales';

// 2. Tipos e interfaces
export interface DatosAceptacion {
  codigo: string;
  nombre: string;
  firmaPng: string;
}

export interface DatosObservaciones {
  observaciones: string;
  nombre: string;
  firmaPng: string;
}

export interface FotoEntrega {
  id: string;
  comentario: string;
  fechaRegistro: string;
}

export interface ActividadEntrega {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoActividad;
  fechaEntrega: string;
  fechaTerminada: string | null;
  fotos: FotoEntrega[];
}

export interface DetalleEntrega {
  id: string;
  estado: EstadoEntrega;
  fechaInicio: string;
  fechaFin: string;
  enviadaEn: string;
  nombreCliente: string | null;
  observaciones: string | null;
  respondidaEn: string | null;
  tieneActa: boolean;
  actividades: ActividadEntrega[];
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_NO_ENCONTRADO = 404;
const CODIGO_CONFLICTO = 409;
const ENCABEZADO_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PREFIJO_DATA_URL = /^data:image\/png;base64,/;
const MENSAJE_ENTREGA_NO_ENCONTRADA = 'Entrega no encontrada';

// 4. Funciones privadas
async function obtenerEntregaDeObra(acceso: AccesoPortal, entregaId: string) {
  const entrega = await prisma.entrega.findFirst({
    where: { id: entregaId, obraId: acceso.obraId, empresaId: acceso.empresaId },
    select: {
      id: true,
      estado: true,
      firmaBlob: true,
      obra: { select: { nombre: true, correoCliente: true } },
    },
  });
  if (!entrega) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_ENTREGA_NO_ENCONTRADA);
  }
  return entrega;
}

function crearErrorRespondida(): ErrorHttp {
  return new ErrorHttp(
    CODIGO_CONFLICTO,
    'Esta entrega ya fue respondida',
    undefined,
    'ENTREGA_RESPONDIDA',
  );
}

function exigirEnviada(estado: EstadoEntrega): void {
  if (estado !== EstadoEntrega.ENVIADA) {
    throw crearErrorRespondida();
  }
}

/**
 * Convierte la firma en base64 a bytes y comprueba que sea un PNG de tamaño razonable.
 *
 * @throws ErrorHttp 400 `FIRMA_INVALIDA`.
 */
export function leerFirmaPng(firmaPng: string): Buffer {
  const datos = Buffer.from(firmaPng.replace(PREFIJO_DATA_URL, ''), 'base64');
  const esPng = datos.subarray(0, ENCABEZADO_PNG.length).equals(ENCABEZADO_PNG);
  if (datos.length <= ENCABEZADO_PNG.length || !esPng || datos.length > TAMANO_MAXIMO_FIRMA_BYTES) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      'Dibuja tu firma para continuar',
      undefined,
      'FIRMA_INVALIDA',
    );
  }
  return datos;
}

/**
 * Guarda la firma y la respuesta del cliente solo si la entrega sigue Enviada. Si otra pestaña
 * respondió primero, `updateMany` no cambia nada y se responde 409 (FR-015).
 */
export async function registrarRespuesta(
  acceso: AccesoPortal,
  entregaId: string,
  estado: EstadoEntrega,
  datos: { nombre: string; firma: Buffer; observaciones?: string },
): Promise<void> {
  const firma = await guardarImagen(acceso.empresaId, CARPETA_FIRMAS, datos.firma, 'image/png');
  const { count } = await prisma.entrega.updateMany({
    where: { id: entregaId, empresaId: acceso.empresaId, estado: EstadoEntrega.ENVIADA },
    data: {
      estado,
      nombreCliente: datos.nombre,
      observaciones: datos.observaciones ?? null,
      firmaBlob: firma.nombreBlob,
      firmaSha256: createHash('sha256').update(datos.firma).digest('hex'),
      respondidaEn: new Date(),
    },
  });
  if (count === 0) {
    await eliminarImagen(firma.nombreBlob);
    throw crearErrorRespondida();
  }
}

// 5. Funciones públicas
/**
 * Detalle de una entrega con la copia fija de sus actividades y fotos (RF-67).
 *
 * @param acceso - Obra y empresa del enlace.
 * @param entregaId - Entrega de esa obra.
 * @returns El detalle.
 * @throws ErrorHttp 404 si la entrega no es de la obra del enlace.
 */
export async function obtenerDetalleEntrega(
  acceso: AccesoPortal,
  entregaId: string,
): Promise<DetalleEntrega> {
  const entrega = await prisma.entrega.findFirst({
    where: { id: entregaId, obraId: acceso.obraId, empresaId: acceso.empresaId },
    include: {
      actividades: {
        orderBy: { fechaEntrega: 'asc' },
        include: { avances: { orderBy: { fechaRegistro: 'asc' } } },
      },
    },
  });
  if (!entrega) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_ENTREGA_NO_ENCONTRADA);
  }
  return {
    id: entrega.id,
    estado: entrega.estado,
    fechaInicio: formatearFecha(entrega.fechaInicio),
    fechaFin: formatearFecha(entrega.fechaFin),
    enviadaEn: entrega.enviadaEn.toISOString(),
    nombreCliente: entrega.nombreCliente,
    observaciones: entrega.observaciones,
    respondidaEn: entrega.respondidaEn?.toISOString() ?? null,
    tieneActa: entrega.estado === EstadoEntrega.ACEPTADA,
    actividades: entrega.actividades.map((actividad) => ({
      id: actividad.actividadId,
      nombre: actividad.nombre,
      descripcion: actividad.descripcion,
      estado: actividad.estado,
      fechaEntrega: formatearFecha(actividad.fechaEntrega),
      fechaTerminada: actividad.fechaTerminada ? formatearFecha(actividad.fechaTerminada) : null,
      fotos: actividad.avances.map((avance) => ({
        id: avance.avanceId,
        comentario: avance.comentario,
        fechaRegistro: avance.fechaRegistro.toISOString(),
      })),
    })),
  };
}

/**
 * Manda al correo de la obra el código para aceptar la entrega.
 *
 * @throws ErrorHttp 404 si no es de la obra; 409 si ya se respondió; 429 si se pidió hace poco.
 */
export async function pedirCodigoAceptacion(
  acceso: AccesoPortal,
  entregaId: string,
): Promise<CodigoSolicitado> {
  const entrega = await obtenerEntregaDeObra(acceso, entregaId);
  exigirEnviada(entrega.estado);
  if (!entrega.obra.correoCliente) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'La obra no tiene correo del cliente');
  }
  return solicitarCodigo(entregaId, entrega.obra.correoCliente, entrega.obra.nombre);
}

/**
 * Comprueba el código antes de pasar a la firma ("✓ Código verificado" en el Figma). No lo
 * gasta: se vuelve a comprobar al aceptar. Los intentos fallidos sí cuentan.
 *
 * @throws ErrorHttp 404, 409 (`ENTREGA_RESPONDIDA`), 400 (`CODIGO_VENCIDO`, `CODIGO_INCORRECTO`).
 */
export async function comprobarCodigoAceptacion(
  acceso: AccesoPortal,
  entregaId: string,
  codigo: string,
): Promise<{ valido: true }> {
  const entrega = await obtenerEntregaDeObra(acceso, entregaId);
  exigirEnviada(entrega.estado);
  await verificarCodigo(entregaId, codigo);
  return { valido: true };
}

/**
 * Acepta una entrega con nombre, código y firma (RF-14, RF-60).
 *
 * @returns El detalle actualizado.
 * @throws ErrorHttp 404, 409 (`ENTREGA_RESPONDIDA`), 400 (`FIRMA_INVALIDA`, `CODIGO_VENCIDO`,
 *   `CODIGO_INCORRECTO`).
 */
export async function aceptarEntrega(
  acceso: AccesoPortal,
  entregaId: string,
  datos: DatosAceptacion,
): Promise<DetalleEntrega> {
  const entrega = await obtenerEntregaDeObra(acceso, entregaId);
  exigirEnviada(entrega.estado);
  // La firma se valida antes que el código para no gastar intentos por un error de dibujo.
  const firma = leerFirmaPng(datos.firmaPng);
  const codigoId = await verificarCodigo(entregaId, datos.codigo);

  await registrarRespuesta(acceso, entregaId, EstadoEntrega.ACEPTADA, {
    nombre: datos.nombre,
    firma,
  });
  await marcarCodigoUsado(codigoId);
  return obtenerDetalleEntrega(acceso, entregaId);
}

/**
 * Registra las observaciones del cliente con su nombre y firma (RF-15; la firma la pide el Figma,
 * D-03). No pide código (P-11). Sus fotos se pueden volver a enviar en otra entrega (P-15).
 *
 * @returns El detalle actualizado.
 * @throws ErrorHttp 404, 409 (`ENTREGA_RESPONDIDA`), 400 (`FIRMA_INVALIDA`).
 */
export async function registrarObservaciones(
  acceso: AccesoPortal,
  entregaId: string,
  datos: DatosObservaciones,
): Promise<DetalleEntrega> {
  const entrega = await obtenerEntregaDeObra(acceso, entregaId);
  exigirEnviada(entrega.estado);
  const firma = leerFirmaPng(datos.firmaPng);

  await registrarRespuesta(acceso, entregaId, EstadoEntrega.CON_OBSERVACIONES, {
    nombre: datos.nombre,
    firma,
    observaciones: datos.observaciones,
  });
  return obtenerDetalleEntrega(acceso, entregaId);
}

/**
 * @returns La imagen PNG de la firma del cliente.
 * @throws ErrorHttp 404 si la entrega no es de la obra o aún no tiene firma.
 */
export async function obtenerFirmaEntrega(
  acceso: AccesoPortal,
  entregaId: string,
): Promise<{ datos: Buffer; tipo: string }> {
  const entrega = await obtenerEntregaDeObra(acceso, entregaId);
  if (!entrega.firmaBlob) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'La entrega aún no tiene firma');
  }
  return obtenerImagen(entrega.firmaBlob);
}
