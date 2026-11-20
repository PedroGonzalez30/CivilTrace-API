/**
 * @archivo servicioActividades.ts
 * @proyecto Civil Trace
 * @descripcion Consulta, creación, cambio de estado y registro de avances con evidencia
 *              fotográfica para actividades de una obra, siempre filtrado por empresaId.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import type {
  DatosActualizarEstadoActividad,
  DatosCrearActividad,
} from '@/esquemas/esquemasActividad';
import { EstadoActividad, EstadoAvance, Rol } from '@/generated/prisma/enums';
import { guardarImagen, obtenerImagen, type TipoImagen } from '@/servicios/servicioAlmacenamiento';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface AvanceActividadRespuesta {
  id: string;
  comentario: string;
  estado: EstadoAvance;
  fechaRegistro: string;
  registradoPor: string | null;
  tieneFoto: boolean;
}

export interface ActividadResumenRespuesta {
  id: string;
  nombre: string;
  estado: EstadoActividad;
  fechaEntrega: string;
  fechaTerminada: string | null;
  responsable: string | null;
  supervisor: string | null;
}

export interface ActividadDetalleRespuesta extends ActividadResumenRespuesta {
  avances: AvanceActividadRespuesta[];
}

interface FilaAvance {
  id: string;
  comentario: string;
  estado: EstadoAvance;
  fechaRegistro: Date;
  registradoPor: { nombre: string } | null;
}

interface FilaActividad {
  id: string;
  nombre: string;
  estado: EstadoActividad;
  fechaEntrega: Date;
  fechaTerminada: Date | null;
  responsable: { nombre: string } | null;
  obra: { supervisor: { nombre: string } | null };
  avances: FilaAvance[];
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_NO_ENCONTRADO = 404;
const LARGO_FECHA_ISO = 10;
const CARPETA_AVANCES = 'avances';

const SELECCION_AVANCE = {
  id: true,
  comentario: true,
  estado: true,
  fechaRegistro: true,
  registradoPor: { select: { nombre: true } },
} as const;

const SELECCION_ACTIVIDAD = {
  id: true,
  nombre: true,
  estado: true,
  fechaEntrega: true,
  fechaTerminada: true,
  responsable: { select: { nombre: true } },
  obra: { select: { supervisor: { select: { nombre: true } } } },
  avances: {
    select: SELECCION_AVANCE,
    orderBy: { fechaRegistro: 'asc' as const },
  },
} as const;

// 4. Funciones privadas
function convertirAvance(avance: FilaAvance): AvanceActividadRespuesta {
  return {
    id: avance.id,
    comentario: avance.comentario,
    estado: avance.estado,
    fechaRegistro: avance.fechaRegistro.toISOString(),
    registradoPor: avance.registradoPor?.nombre ?? null,
    tieneFoto: true,
  };
}

function convertirResumen(fila: FilaActividad): ActividadResumenRespuesta {
  return {
    id: fila.id,
    nombre: fila.nombre,
    estado: fila.estado,
    fechaEntrega: fila.fechaEntrega.toISOString().slice(0, LARGO_FECHA_ISO),
    fechaTerminada: fila.fechaTerminada
      ? fila.fechaTerminada.toISOString().slice(0, LARGO_FECHA_ISO)
      : null,
    responsable: fila.responsable?.nombre ?? null,
    supervisor: fila.obra.supervisor?.nombre ?? null,
  };
}

function convertirDetalle(fila: FilaActividad): ActividadDetalleRespuesta {
  return {
    ...convertirResumen(fila),
    avances: fila.avances.map(convertirAvance),
  };
}

async function asegurarObraDeEmpresa(empresaId: string, idObra: string): Promise<void> {
  const obra = await prisma.obra.findFirst({
    where: { id: idObra, empresaId },
    select: { id: true },
  });
  if (!obra) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Obra no encontrada');
  }
}

async function validarResponsable(
  empresaId: string,
  responsableId: string | undefined,
): Promise<string | null> {
  if (!responsableId) {
    return null;
  }
  const usuario = await prisma.usuario.findFirst({
    where: {
      id: responsableId,
      empresaId,
      rol: { in: [Rol.TRABAJADOR, Rol.SUPERVISOR] },
    },
    select: { id: true },
  });
  if (!usuario) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'El responsable no pertenece a tu empresa');
  }
  return usuario.id;
}

// 5. Funciones públicas
export async function listarActividadesObra(
  empresaId: string,
  idObra: string,
): Promise<ActividadResumenRespuesta[]> {
  await asegurarObraDeEmpresa(empresaId, idObra);
  const filas = await prisma.actividad.findMany({
    where: { empresaId, obraId: idObra },
    select: SELECCION_ACTIVIDAD,
    orderBy: [{ fechaEntrega: 'asc' }, { creadaEn: 'desc' }],
  });
  return filas.map(convertirResumen);
}

export async function obtenerDetalleActividad(
  empresaId: string,
  idObra: string,
  idActividad: string,
): Promise<ActividadDetalleRespuesta> {
  const fila = await prisma.actividad.findFirst({
    where: { id: idActividad, obraId: idObra, empresaId },
    select: SELECCION_ACTIVIDAD,
  });
  if (!fila) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Actividad no encontrada');
  }
  return convertirDetalle(fila);
}

export async function crearActividadObra(
  empresaId: string,
  idObra: string,
  datos: DatosCrearActividad,
): Promise<ActividadDetalleRespuesta> {
  await asegurarObraDeEmpresa(empresaId, idObra);
  const responsableId = await validarResponsable(empresaId, datos.responsableId);

  const creada = await prisma.actividad.create({
    data: {
      nombre: datos.nombre,
      fechaEntrega: new Date(`${datos.fechaEntrega}T00:00:00.000Z`),
      estado: EstadoActividad.ACTIVA,
      obraId: idObra,
      empresaId,
      responsableId,
    },
    select: SELECCION_ACTIVIDAD,
  });
  return convertirDetalle(creada);
}

export async function actualizarEstadoActividad(
  empresaId: string,
  idObra: string,
  idActividad: string,
  datos: DatosActualizarEstadoActividad,
): Promise<ActividadDetalleRespuesta> {
  const existente = await prisma.actividad.findFirst({
    where: { id: idActividad, obraId: idObra, empresaId },
    select: { id: true },
  });
  if (!existente) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Actividad no encontrada');
  }

  const fechaTerminada =
    datos.estado === EstadoActividad.TERMINADA
      ? new Date(
          `${datos.fechaTerminada ?? new Date().toISOString().slice(0, LARGO_FECHA_ISO)}T00:00:00.000Z`,
        )
      : null;

  const actualizada = await prisma.actividad.update({
    where: { id: idActividad },
    data: {
      estado: datos.estado,
      fechaTerminada,
    },
    select: SELECCION_ACTIVIDAD,
  });
  return convertirDetalle(actualizada);
}

export async function registrarAvanceActividad(
  empresaId: string,
  usuarioId: string,
  idObra: string,
  idActividad: string,
  imagen: { datos: Buffer; tipo: TipoImagen },
  comentario: string,
): Promise<AvanceActividadRespuesta> {
  const actividad = await prisma.actividad.findFirst({
    where: { id: idActividad, obraId: idObra, empresaId },
    select: { id: true },
  });
  if (!actividad) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Actividad no encontrada');
  }

  const archivo = await guardarImagen(empresaId, CARPETA_AVANCES, imagen.datos, imagen.tipo);
  const avance = await prisma.avanceActividad.create({
    data: {
      comentario,
      fotoBlob: archivo.nombreBlob,
      fotoTipo: archivo.tipo,
      estado: EstadoAvance.APROBADO,
      actividadId: idActividad,
      empresaId,
      registradoPorId: usuarioId,
    },
    select: SELECCION_AVANCE,
  });
  return convertirAvance(avance);
}

export async function obtenerFotoAvance(
  empresaId: string,
  idObra: string,
  idActividad: string,
  idAvance: string,
): Promise<{ datos: Buffer; tipo: string }> {
  const avance = await prisma.avanceActividad.findFirst({
    where: {
      id: idAvance,
      actividadId: idActividad,
      empresaId,
      actividad: { obraId: idObra },
    },
    select: { fotoBlob: true, fotoTipo: true },
  });
  if (!avance) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Evidencia no encontrada');
  }

  const imagen = await obtenerImagen(avance.fotoBlob);
  return {
    datos: imagen.datos,
    tipo: avance.fotoTipo || imagen.tipo,
  };
}
