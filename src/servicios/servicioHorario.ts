/**
 * @archivo servicioHorario.ts
 * @proyecto Civil Trace
 * @descripcion Horario de entrada y salida por obra (general o "solo hoy"): consultar el horario
 *   vigente de un día y guardar cambios. Lo usan asistencia y calendario.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada (horario de referencia), D-06
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-06)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { ZONA_HORARIA_POR_DEFECTO } from '@/constantes/asistencia';
import { AlcanceHorario } from '@/generated/prisma/enums';
import {
  construirInstante,
  convertirFechaADate,
  formatearFecha,
  obtenerDiaSemana,
  sumarDias,
} from '@/utilidades/fechasLocales';

// 2. Tipos e interfaces
export interface FilaHorario {
  alcance: AlcanceHorario;
  fecha: Date | null;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  diasLaborales: number[];
  creadoEn: Date;
}

export interface HorarioEfectivo {
  fecha: string;
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  diasLaborales: number[];
  esDiaLaborable: boolean;
  esExcepcion: boolean;
}

// 3. Constantes del módulo
const MEDIANOCHE = '00:00';
const SELECCION_HORARIO = {
  alcance: true,
  fecha: true,
  horaEntrada: true,
  horaSalida: true,
  toleranciaMinutos: true,
  diasLaborales: true,
  creadoEn: true,
} as const;

// 4. Funciones
/**
 * Zona horaria de la empresa (D-15).
 *
 * @param empresaId - Empresa.
 * @returns Zona IANA.
 */
export async function obtenerZonaHorariaEmpresa(empresaId: string): Promise<string> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { zonaHoraria: true },
  });
  return empresa?.zonaHoraria ?? ZONA_HORARIA_POR_DEFECTO;
}

/**
 * Todas las filas de horario de una obra, de la más vieja a la más reciente. Se cargan juntas
 * para resolver muchos días sin una consulta por día (calendario).
 *
 * @param obraId - Obra.
 * @returns Filas de horario.
 */
export async function obtenerFilasHorario(obraId: string): Promise<FilaHorario[]> {
  return prisma.horarioObra.findMany({
    where: { obraId },
    select: SELECCION_HORARIO,
    orderBy: { creadoEn: 'asc' },
  });
}

/**
 * Horario que aplicaba en una fecha, a partir de las filas ya cargadas. Gana la excepción "solo
 * hoy" más reciente de esa fecha; si no hay, el horario general que estaba vigente al terminar
 * ese día, para que cambiar el horario no altere días pasados.
 *
 * @param filas - Filas de horario de la obra (de obtenerFilasHorario).
 * @param fecha - Fecha local YYYY-MM-DD.
 * @param zona - Zona horaria de la empresa.
 * @returns El horario efectivo o null si la obra no tenía horario.
 */
export function resolverHorarioEfectivo(
  filas: FilaHorario[],
  fecha: string,
  zona: string,
): HorarioEfectivo | null {
  const finDelDia = construirInstante(sumarDias(fecha, 1), MEDIANOCHE, zona);
  let elegido: FilaHorario | undefined;
  let esExcepcion = false;

  for (const fila of filas) {
    const esDeEseDia =
      fila.alcance === AlcanceHorario.DIA && fila.fecha && formatearFecha(fila.fecha) === fecha;
    if (esDeEseDia) {
      elegido = fila;
      esExcepcion = true;
    } else if (
      !esExcepcion &&
      fila.alcance === AlcanceHorario.GENERAL &&
      fila.creadoEn < finDelDia
    ) {
      elegido = fila;
    }
  }

  if (!elegido) {
    return null;
  }
  return {
    fecha,
    horaEntrada: elegido.horaEntrada,
    horaSalida: elegido.horaSalida,
    toleranciaMinutos: elegido.toleranciaMinutos,
    diasLaborales: elegido.diasLaborales,
    esDiaLaborable: elegido.diasLaborales.includes(obtenerDiaSemana(fecha)),
    esExcepcion,
  };
}

/**
 * Horario efectivo de una obra en una fecha.
 *
 * @param obraId - Obra.
 * @param fecha - Fecha local YYYY-MM-DD.
 * @param zona - Zona horaria de la empresa.
 * @returns El horario o null si la obra no tiene horario.
 */
export async function obtenerHorarioEfectivo(
  obraId: string,
  fecha: string,
  zona: string,
): Promise<HorarioEfectivo | null> {
  const filas = await prisma.horarioObra.findMany({
    where: {
      obraId,
      OR: [{ alcance: AlcanceHorario.GENERAL }, { fecha: convertirFechaADate(fecha) }],
    },
    select: SELECCION_HORARIO,
    orderBy: { creadoEn: 'asc' },
  });
  return resolverHorarioEfectivo(filas, fecha, zona);
}

/**
 * Horario general vigente (el más reciente), con quién lo guardó.
 *
 * @param obraId - Obra.
 * @returns El horario general o null.
 */
export async function obtenerHorarioGeneral(obraId: string) {
  return prisma.horarioObra.findFirst({
    where: { obraId, alcance: AlcanceHorario.GENERAL },
    orderBy: { creadoEn: 'desc' },
    select: { ...SELECCION_HORARIO, creadoPor: { select: { nombre: true } } },
  });
}
