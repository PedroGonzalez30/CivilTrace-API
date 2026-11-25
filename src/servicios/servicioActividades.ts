/**
 * @archivo servicioActividades.ts
 * @proyecto Civil Trace
 * @descripcion Consulta, creación, cambio de estado, avances con evidencia fotográfica y revisión
 *              de evidencias de las actividades de una obra, siempre filtrado por empresaId y por
 *              la relación del usuario con la obra.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 20/11/2026
 * @version 2.1.0
 * @historial 24/11/2026 - Emilio Manuel Esquivel - Permisos por obra y responsable, evidencia del
 *   trabajador pendiente de revisión (D-10), revisión con observación, entrega "Terminado", mis
 *   actividades, descripción y fecha de inicio (feature 003, R1–R8)
 *   24/11/2026 - Emilio Manuel Esquivel - Bloqueo de actividades terminadas de entregas aceptadas
 *   (feature 004, RF-17 Bloquear entrega aceptada, D-31)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import type {
  DatosActualizarEstadoActividad,
  DatosCrearActividad,
  DatosRevisionAvance,
} from '@/esquemas/esquemasActividad';
import { EstadoActividad, EstadoAvance, Rol, TipoAvance } from '@/generated/prisma/enums';
import { guardarImagen, obtenerImagen, type TipoImagen } from '@/servicios/servicioAlmacenamiento';
import {
  estaActividadBloqueada,
  exigirActividadNoBloqueada,
} from '@/servicios/servicioDocumentosEntrega';
import { obtenerZonaHorariaEmpresa } from '@/servicios/servicioHorario';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import { convertirFechaADate, obtenerFechaLocal } from '@/utilidades/fechasLocales';
import {
  exigirAccesoAObra,
  exigirSupervisorODueno,
  obtenerObraDeEmpresa,
  type ObraBasica,
} from '@/utilidades/permisosObra';

// 2. Tipos e interfaces
export interface AvanceActividadRespuesta {
  id: string;
  comentario: string;
  estado: EstadoAvance;
  tipo: TipoAvance;
  fechaRegistro: string;
  registradoPor: string | null;
  observacion: string | null;
  revisadoPor: string | null;
  revisadoEn: string | null;
  tieneFoto: boolean;
}

export interface ActividadResumenRespuesta {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoActividad;
  fechaInicio: string | null;
  fechaEntrega: string;
  fechaTerminada: string | null;
  responsable: string | null;
  responsableId: string | null;
  supervisor: string | null;
  // Tiene una entrega "Terminado" esperando la revisión del supervisor.
  enRevision: boolean;
}

export interface ActividadDetalleRespuesta extends ActividadResumenRespuesta {
  avances: AvanceActividadRespuesta[];
}

export interface MiActividadRespuesta extends ActividadResumenRespuesta {
  obraId: string;
  obraNombre: string;
}

export interface RevisionRespuesta {
  avance: AvanceActividadRespuesta;
  actividad: ActividadDetalleRespuesta;
}

interface FilaAvance {
  id: string;
  comentario: string;
  estado: EstadoAvance;
  tipo: TipoAvance;
  fechaRegistro: Date;
  observacion: string | null;
  revisadoEn: Date | null;
  registradoPor: { nombre: string } | null;
  revisadoPor: { nombre: string } | null;
}

interface FilaActividad {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoActividad;
  fechaInicio: Date | null;
  fechaEntrega: Date;
  fechaTerminada: Date | null;
  responsableId: string | null;
  responsable: { nombre: string } | null;
  obra: { supervisor: { nombre: string } | null };
  avances: FilaAvance[];
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_PROHIBIDO = 403;
const CODIGO_NO_ENCONTRADO = 404;
const CODIGO_CONFLICTO = 409;
const LARGO_FECHA_ISO = 10;
const CARPETA_AVANCES = 'avances';
const MENSAJE_SIN_PERMISO = 'No tienes permiso para realizar esta acción';
const MENSAJE_NO_ENCONTRADA = 'Actividad no encontrada';

const SELECCION_AVANCE = {
  id: true,
  comentario: true,
  estado: true,
  tipo: true,
  fechaRegistro: true,
  observacion: true,
  revisadoEn: true,
  registradoPor: { select: { nombre: true } },
  revisadoPor: { select: { nombre: true } },
} as const;

const SELECCION_ACTIVIDAD = {
  id: true,
  nombre: true,
  descripcion: true,
  estado: true,
  fechaInicio: true,
  fechaEntrega: true,
  fechaTerminada: true,
  responsableId: true,
  responsable: { select: { nombre: true } },
  obra: { select: { supervisor: { select: { nombre: true } } } },
  avances: {
    select: SELECCION_AVANCE,
    orderBy: { fechaRegistro: 'asc' as const },
  },
} as const;

// 4. Funciones privadas
function aFechaIso(fecha: Date | null): string | null {
  return fecha ? fecha.toISOString().slice(0, LARGO_FECHA_ISO) : null;
}

function convertirAvance(avance: FilaAvance): AvanceActividadRespuesta {
  return {
    id: avance.id,
    comentario: avance.comentario,
    estado: avance.estado,
    tipo: avance.tipo,
    fechaRegistro: avance.fechaRegistro.toISOString(),
    registradoPor: avance.registradoPor?.nombre ?? null,
    observacion: avance.observacion,
    revisadoPor: avance.revisadoPor?.nombre ?? null,
    revisadoEn: avance.revisadoEn?.toISOString() ?? null,
    tieneFoto: true,
  };
}

function convertirResumen(fila: FilaActividad): ActividadResumenRespuesta {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    estado: fila.estado,
    fechaInicio: aFechaIso(fila.fechaInicio),
    fechaEntrega: aFechaIso(fila.fechaEntrega) ?? '',
    fechaTerminada: aFechaIso(fila.fechaTerminada),
    responsable: fila.responsable?.nombre ?? null,
    responsableId: fila.responsableId,
    supervisor: fila.obra.supervisor?.nombre ?? null,
    enRevision: fila.avances.some(
      (avance) => avance.tipo === TipoAvance.TERMINADO && avance.estado === EstadoAvance.PENDIENTE,
    ),
  };
}

function convertirDetalle(fila: FilaActividad): ActividadDetalleRespuesta {
  return { ...convertirResumen(fila), avances: fila.avances.map(convertirAvance) };
}

async function validarResponsable(
  empresaId: string,
  responsableId: string | undefined,
): Promise<string | null> {
  if (!responsableId) {
    return null;
  }
  const usuario = await prisma.usuario.findFirst({
    where: { id: responsableId, empresaId, rol: { in: [Rol.TRABAJADOR, Rol.SUPERVISOR] } },
    select: { id: true },
  });
  if (!usuario) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'El responsable no pertenece a tu empresa');
  }
  return usuario.id;
}

// Obra de la empresa del token a la que el usuario tiene acceso (R1).
async function obtenerObraAccesible(
  usuario: DatosTokenAcceso,
  idObra: string,
): Promise<ObraBasica> {
  const obra = await obtenerObraDeEmpresa(idObra, usuario.empresaId);
  await exigirAccesoAObra(obra, usuario);
  return obra;
}

async function buscarActividad(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
): Promise<FilaActividad> {
  const fila = await prisma.actividad.findFirst({
    where: { id: idActividad, obraId: idObra, empresaId: usuario.empresaId },
    select: SELECCION_ACTIVIDAD,
  });
  if (!fila) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_NO_ENCONTRADA);
  }
  // El trabajador solo ve las actividades de las que es responsable (R1).
  if (usuario.rol === Rol.TRABAJADOR && fila.responsableId !== usuario.sub) {
    throw new ErrorHttp(CODIGO_PROHIBIDO, MENSAJE_SIN_PERMISO);
  }
  return fila;
}

async function releerActividad(idActividad: string): Promise<ActividadDetalleRespuesta> {
  const fila = await prisma.actividad.findUniqueOrThrow({
    where: { id: idActividad },
    select: SELECCION_ACTIVIDAD,
  });
  return convertirDetalle(fila);
}

async function fechaLocalDeHoy(empresaId: string, instante: Date): Promise<Date> {
  const zona = await obtenerZonaHorariaEmpresa(empresaId);
  return convertirFechaADate(obtenerFechaLocal(instante, zona));
}

// 5. Funciones públicas
/**
 * @param usuario - Usuario del token.
 * @param idObra - Obra consultada.
 * @returns Las actividades de la obra; el trabajador solo recibe las suyas (R1).
 * @throws ErrorHttp 404 si la obra no es de la empresa; 403 si no tiene relación con ella.
 */
export async function listarActividadesObra(
  usuario: DatosTokenAcceso,
  idObra: string,
): Promise<ActividadResumenRespuesta[]> {
  await obtenerObraAccesible(usuario, idObra);
  const filas = await prisma.actividad.findMany({
    where: {
      empresaId: usuario.empresaId,
      obraId: idObra,
      ...(usuario.rol === Rol.TRABAJADOR ? { responsableId: usuario.sub } : {}),
    },
    select: SELECCION_ACTIVIDAD,
    orderBy: [{ fechaEntrega: 'asc' }, { creadaEn: 'desc' }],
  });
  return filas.map(convertirResumen);
}

/**
 * @returns La actividad con su cronología de avances (R1).
 * @throws ErrorHttp 404 si no existe en la obra; 403 sin relación con ella.
 */
export async function obtenerDetalleActividad(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
): Promise<ActividadDetalleRespuesta & { bloqueada: boolean }> {
  await obtenerObraAccesible(usuario, idObra);
  const detalle = convertirDetalle(await buscarActividad(usuario, idObra, idActividad));
  // La app oculta los botones de edición cuando la actividad ya se entregó y aceptó (RF-17).
  return { ...detalle, bloqueada: await estaActividadBloqueada(idActividad) };
}

/**
 * Crea una actividad. Solo el supervisor de la obra o el dueño (R1); la fecha de inicio ya se
 * validó contra la de entrega en el esquema (R8).
 */
export async function crearActividadObra(
  usuario: DatosTokenAcceso,
  idObra: string,
  datos: DatosCrearActividad,
): Promise<ActividadDetalleRespuesta> {
  const obra = await obtenerObraDeEmpresa(idObra, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);
  const responsableId = await validarResponsable(usuario.empresaId, datos.responsableId);

  const creada = await prisma.actividad.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      fechaInicio: datos.fechaInicio ? convertirFechaADate(datos.fechaInicio) : null,
      fechaEntrega: convertirFechaADate(datos.fechaEntrega),
      estado: EstadoActividad.ACTIVA,
      obraId: idObra,
      empresaId: usuario.empresaId,
      responsableId,
    },
    select: SELECCION_ACTIVIDAD,
  });
  return convertirDetalle(creada);
}

/** Cambia el estado a mano (dueño o supervisor de la obra). */
export async function actualizarEstadoActividad(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
  datos: DatosActualizarEstadoActividad,
): Promise<ActividadDetalleRespuesta> {
  const obra = await obtenerObraDeEmpresa(idObra, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);
  await buscarActividad(usuario, idObra, idActividad);
  await exigirActividadNoBloqueada(idActividad);

  const fechaTerminada =
    datos.estado === EstadoActividad.TERMINADA
      ? datos.fechaTerminada
        ? convertirFechaADate(datos.fechaTerminada)
        : await fechaLocalDeHoy(usuario.empresaId, new Date())
      : null;

  const actualizada = await prisma.actividad.update({
    where: { id: idActividad },
    data: { estado: datos.estado, fechaTerminada },
    select: SELECCION_ACTIVIDAD,
  });
  return convertirDetalle(actualizada);
}

/**
 * Registra un avance con foto. La del trabajador responsable nace pendiente; la del supervisor o
 * el dueño nace aprobada y, si es "Terminado", termina la actividad (R2–R4).
 *
 * @throws ErrorHttp 403 sin permiso; 409 si la actividad ya terminó o ya hay una entrega en
 *   revisión.
 */
export async function registrarAvanceActividad(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
  imagen: { datos: Buffer; tipo: TipoImagen },
  comentario: string,
  tipo: TipoAvance,
): Promise<AvanceActividadRespuesta> {
  await obtenerObraAccesible(usuario, idObra);
  const actividad = await buscarActividad(usuario, idObra, idActividad);
  await exigirActividadNoBloqueada(idActividad);
  if (actividad.estado === EstadoActividad.TERMINADA) {
    throw new ErrorHttp(CODIGO_CONFLICTO, 'La actividad ya está terminada');
  }
  if (tipo === TipoAvance.TERMINADO && convertirResumen(actividad).enRevision) {
    throw new ErrorHttp(CODIGO_CONFLICTO, 'Ya hay una entrega esperando la revisión');
  }

  const esTrabajador = usuario.rol === Rol.TRABAJADOR;
  const archivo = await guardarImagen(
    usuario.empresaId,
    CARPETA_AVANCES,
    imagen.datos,
    imagen.tipo,
  );
  const ahora = new Date();
  const avance = await prisma.$transaction(async (transaccion) => {
    const creado = await transaccion.avanceActividad.create({
      data: {
        comentario,
        fotoBlob: archivo.nombreBlob,
        fotoTipo: archivo.tipo,
        tipo,
        estado: esTrabajador ? EstadoAvance.PENDIENTE : EstadoAvance.APROBADO,
        actividadId: idActividad,
        empresaId: usuario.empresaId,
        registradoPorId: usuario.sub,
      },
      select: SELECCION_AVANCE,
    });
    if (!esTrabajador && tipo === TipoAvance.TERMINADO) {
      await transaccion.actividad.update({
        where: { id: idActividad },
        data: {
          estado: EstadoActividad.TERMINADA,
          fechaTerminada: await fechaLocalDeHoy(usuario.empresaId, ahora),
        },
      });
    }
    return creado;
  });
  return convertirAvance(avance);
}

/**
 * Aprueba o rechaza un avance pendiente (R5). Aprobar una entrega "Terminado" termina la actividad
 * con la fecha local de la entrega (R6); rechazarla la deja activa.
 *
 * @throws ErrorHttp 403 si no es el supervisor de la obra ni el dueño; 404 si no existe; 409 si ya
 *   se revisó.
 */
export async function revisarAvance(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
  idAvance: string,
  datos: DatosRevisionAvance,
): Promise<RevisionRespuesta> {
  const obra = await obtenerObraDeEmpresa(idObra, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);
  await buscarActividad(usuario, idObra, idActividad);
  await exigirActividadNoBloqueada(idActividad);

  const existente = await prisma.avanceActividad.findFirst({
    where: { id: idAvance, actividadId: idActividad, empresaId: usuario.empresaId },
    select: { estado: true, tipo: true, fechaRegistro: true },
  });
  if (!existente) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Evidencia no encontrada');
  }
  if (existente.estado !== EstadoAvance.PENDIENTE) {
    throw new ErrorHttp(CODIGO_CONFLICTO, 'Esta evidencia ya fue revisada');
  }

  const aprobar = datos.decision === 'APROBAR';
  const terminaActividad = aprobar && existente.tipo === TipoAvance.TERMINADO;
  const fechaTerminada = terminaActividad
    ? await fechaLocalDeHoy(usuario.empresaId, existente.fechaRegistro)
    : null;

  const avance = await prisma.$transaction(async (transaccion) => {
    const revisado = await transaccion.avanceActividad.update({
      where: { id: idAvance },
      data: {
        estado: aprobar ? EstadoAvance.APROBADO : EstadoAvance.RECHAZADO,
        observacion: datos.observacion ?? null,
        revisadoPorId: usuario.sub,
        revisadoEn: new Date(),
      },
      select: SELECCION_AVANCE,
    });
    if (terminaActividad) {
      await transaccion.actividad.update({
        where: { id: idActividad },
        data: { estado: EstadoActividad.TERMINADA, fechaTerminada },
      });
    }
    return revisado;
  });

  return { avance: convertirAvance(avance), actividad: await releerActividad(idActividad) };
}

/**
 * @param usuario - Trabajador del token.
 * @returns Sus actividades activas en todas las obras, con el nombre de la obra, por entrega.
 * @throws ErrorHttp 403 si no es trabajador.
 */
export async function listarMisActividades(
  usuario: DatosTokenAcceso,
): Promise<MiActividadRespuesta[]> {
  if (usuario.rol !== Rol.TRABAJADOR) {
    throw new ErrorHttp(CODIGO_PROHIBIDO, MENSAJE_SIN_PERMISO);
  }
  const filas = await prisma.actividad.findMany({
    where: {
      empresaId: usuario.empresaId,
      responsableId: usuario.sub,
      estado: EstadoActividad.ACTIVA,
    },
    select: {
      ...SELECCION_ACTIVIDAD,
      obraId: true,
      obra: { select: { nombre: true, supervisor: { select: { nombre: true } } } },
    },
    orderBy: [{ fechaEntrega: 'asc' }, { creadaEn: 'desc' }],
  });
  return filas.map((fila) => ({
    ...convertirResumen(fila),
    obraId: fila.obraId,
    obraNombre: fila.obra.nombre,
  }));
}

/**
 * @returns La foto de un avance, si el usuario puede ver la actividad (R1).
 * @throws ErrorHttp 404 si no existe.
 */
export async function obtenerFotoAvance(
  usuario: DatosTokenAcceso,
  idObra: string,
  idActividad: string,
  idAvance: string,
): Promise<{ datos: Buffer; tipo: string }> {
  await obtenerObraAccesible(usuario, idObra);
  await buscarActividad(usuario, idObra, idActividad);
  const avance = await prisma.avanceActividad.findFirst({
    where: { id: idAvance, actividadId: idActividad, empresaId: usuario.empresaId },
    select: { fotoBlob: true, fotoTipo: true },
  });
  if (!avance) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'Evidencia no encontrada');
  }
  const imagen = await obtenerImagen(avance.fotoBlob);
  return { datos: imagen.datos, tipo: avance.fotoTipo || imagen.tipo };
}
