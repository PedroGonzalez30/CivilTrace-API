/**
 * @archivo servicioObras.ts
 * @proyecto Civil Trace
 * @descripcion Lógica de consulta y creación de obras, siempre filtrada por empresa.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 * @requerimientos RF-44 Mostrar obras
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { Rol } from '@/generated/prisma/enums';
import type { DatosCrearObra } from '@/esquemas/esquemasObra';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface ObraRespuesta {
  id: string;
  nombre: string;
  resumen: string;
  descripcion: string;
  direccion: string;
  fechaInicio: string;
  fechaFinal: string;
  cliente: string | null;
  correoCliente: string | null;
  supervisor: string | null;
}

interface ObraConSupervisor {
  id: string;
  nombre: string;
  resumen: string;
  descripcion: string;
  direccion: string;
  fechaInicio: Date;
  fechaFinal: Date;
  cliente: string | null;
  correoCliente: string | null;
  supervisor: { nombre: string } | null;
}

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const LARGO_FECHA_ISO = 10;
const MAXIMO_COINCIDENCIAS_SUPERVISOR = 2;
const LONGITUD_MAXIMA_RESUMEN = 100;

// Solo se leen estos campos: así nunca se filtra por error un dato interno.
const SELECCION_OBRA = {
  id: true,
  nombre: true,
  resumen: true,
  descripcion: true,
  direccion: true,
  fechaInicio: true,
  fechaFinal: true,
  cliente: true,
  correoCliente: true,
  supervisor: { select: { nombre: true } },
} as const;

// 4. Funciones privadas
function convertirObra(obra: ObraConSupervisor): ObraRespuesta {
  return {
    id: obra.id,
    nombre: obra.nombre,
    resumen: obra.resumen,
    descripcion: obra.descripcion,
    direccion: obra.direccion,
    fechaInicio: obra.fechaInicio.toISOString().slice(0, LARGO_FECHA_ISO),
    fechaFinal: obra.fechaFinal.toISOString().slice(0, LARGO_FECHA_ISO),
    cliente: obra.cliente,
    correoCliente: obra.correoCliente,
    supervisor: obra.supervisor?.nombre ?? null,
  };
}

// La búsqueda incluye empresaId para que nunca se asigne un supervisor de otra empresa.
async function buscarIdSupervisor(
  empresaId: string,
  nombre: string | undefined,
): Promise<string | null> {
  if (!nombre) {
    return null;
  }

  const coincidencias = await prisma.usuario.findMany({
    where: { empresaId, rol: Rol.SUPERVISOR, nombre: { equals: nombre, mode: 'insensitive' } },
    select: { id: true },
    take: MAXIMO_COINCIDENCIAS_SUPERVISOR,
  });

  const [primera, segunda] = coincidencias;
  if (!primera) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'No hay un supervisor con ese nombre en tu empresa');
  }
  if (segunda) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Hay varios supervisores con ese nombre');
  }
  return primera.id;
}

function crearResumen(descripcion: string): string {
  return descripcion.length > LONGITUD_MAXIMA_RESUMEN
    ? `${descripcion.slice(0, LONGITUD_MAXIMA_RESUMEN)}…`
    : descripcion;
}

async function validarSupervisor(
  empresaId: string,
  supervisorId: string | undefined,
): Promise<string | null> {
  if (!supervisorId) {
    return null;
  }
  const supervisor = await prisma.usuario.findFirst({
    where: { id: supervisorId, empresaId, rol: Rol.SUPERVISOR },
    select: { id: true },
  });
  if (!supervisor) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'El supervisor no pertenece a tu empresa');
  }
  return supervisor.id;
}

async function validarTrabajadores(empresaId: string, ids: string[]): Promise<string[]> {
  const idsUnicos = [...new Set(ids)];
  if (idsUnicos.length === 0) {
    return [];
  }
  const encontrados = await prisma.usuario.count({
    where: { id: { in: idsUnicos }, empresaId, rol: Rol.TRABAJADOR },
  });
  if (encontrados !== idsUnicos.length) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Un trabajador no pertenece a tu empresa');
  }
  return idsUnicos;
}


// 5. Funciones públicas
/**
 * Lista las obras de una empresa, de la más reciente a la más antigua.
 *
 * @param empresaId - Id de la empresa; debe salir del token, nunca de la petición.
 * @returns Las obras de la empresa; vacío si no tiene ninguna.
 */
export async function listarObras(empresaId: string): Promise<ObraRespuesta[]> {
  const obras = await prisma.obra.findMany({
    where: { empresaId },
    select: SELECCION_OBRA,
    orderBy: { creadaEn: 'desc' },
  });
  return obras.map(convertirObra);
}

/**
 * Crea una obra dentro de la empresa del usuario.
 *
 * @param empresaId - Id de la empresa; debe salir del token, nunca de la petición.
 * @param datos - Datos ya validados con Zod.
 * @returns La obra creada.
 * @throws ErrorHttp 400 si el supervisor indicado no existe o es ambiguo.
 */
export async function crearObra(empresaId: string, datos: DatosCrearObra): Promise<ObraRespuesta> {
  const supervisorId = await validarSupervisor(empresaId, datos.supervisorId);
  const trabajadoresIds = await validarTrabajadores(empresaId, datos.trabajadoresIds);

  const obra = await prisma.obra.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      resumen: crearResumen(datos.descripcion),
      direccion: datos.direccion,
      cliente: datos.cliente,
      correoCliente: datos.correoCliente,
      // Fechas a medianoche UTC para que la columna DATE no se corra de día.
      fechaInicio: new Date(`${datos.fechaInicio}T00:00:00.000Z`),
      fechaFinal: new Date(`${datos.fechaFinal}T00:00:00.000Z`),
      empresaId,
      supervisorId,
      trabajadores: { connect: trabajadoresIds.map((id) => ({ id })) },
    },
    select: SELECCION_OBRA,
  });
  return convertirObra(obra);
}