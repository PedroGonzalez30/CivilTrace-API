/**
 * @archivo servicioCalendarioAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Calendario mensual de asistencia por trabajador: color de cada día, faltas
 *   calculadas, días con descuento ($) y resumen del mes.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-56 Mostrar días con descuento, RF-58 Mostrar calendario de asistencia,
 *   D-08, D-13, D-16, D-20
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-08)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { EfectoPago, TipoJornada } from '@/generated/prisma/enums';
import { obtenerFilasHorario, resolverHorarioEfectivo } from '@/servicios/servicioHorario';
import {
  convertirFechaADate,
  formatearFecha,
  obtenerDiasDelMes,
  obtenerFechaLocal,
  sumarDias,
} from '@/utilidades/fechasLocales';

// 2. Tipos e interfaces
export type ColorDia = 'VERDE' | 'NARANJA' | 'ROJO';

export interface DiaAsistencia {
  fecha: string;
  obraId: string;
  color: ColorDia;
  tipoJornada: TipoJornada;
  esFaltaCalculada: boolean;
  conDescuento: boolean;
}

export interface ObraParaCalendario {
  id: string;
  fechaInicio: Date;
  fechaFinal: Date;
}

interface DatosCalculoDias {
  trabajador: { id: string; creadoEn: Date };
  obras: ObraParaCalendario[];
  mes: string;
  zona: string;
  hoy: string;
}

// 3. Constantes del módulo
const COLOR_POR_TIPO: Record<TipoJornada, ColorDia> = {
  [TipoJornada.COMPLETA]: 'VERDE',
  [TipoJornada.RETARDO]: 'NARANJA',
  [TipoJornada.MEDIA_JORNADA]: 'NARANJA',
  [TipoJornada.SALIDA_TEMPRANA]: 'NARANJA',
  [TipoJornada.FALTA]: 'ROJO',
};
const EFECTOS_CON_DESCUENTO: EfectoPago[] = [EfectoPago.MEDIO_DIA, EfectoPago.SIN_PAGO];
const LARGO_MES = 7;

// 4. Funciones
/** Indica si un efecto en el pago es un descuento (muestra el símbolo $, D-13). */
export function esConDescuento(efectoPago: EfectoPago): boolean {
  return EFECTOS_CON_DESCUENTO.includes(efectoPago);
}

/**
 * Obras en las que el trabajador está asignado hoy, dentro de su empresa.
 *
 * @param trabajadorId - Trabajador.
 * @param empresaId - Empresa de quien consulta.
 * @returns Obras con sus fechas.
 */
export async function obtenerObrasDelTrabajador(
  trabajadorId: string,
  empresaId: string,
): Promise<(ObraParaCalendario & { nombre: string; supervisorId: string | null })[]> {
  return prisma.obra.findMany({
    where: { empresaId, trabajadores: { some: { id: trabajadorId } } },
    select: { id: true, nombre: true, supervisorId: true, fechaInicio: true, fechaFinal: true },
    orderBy: { nombre: 'asc' },
  });
}

/**
 * Días con color del mes para un trabajador en las obras indicadas. Los días con registro toman
 * su tipo de jornada; un día laborable pasado sin registro es una falta calculada. Las faltas
 * cuentan desde el inicio de la obra o el alta del trabajador, lo que sea posterior (D-20).
 *
 * @returns Días con color, ordenados por fecha.
 */
export async function calcularDiasAsistencia(datos: DatosCalculoDias): Promise<DiaAsistencia[]> {
  const dias = obtenerDiasDelMes(datos.mes);
  const primerDia = dias[0] ?? `${datos.mes}-01`;
  const ultimoDia = dias[dias.length - 1] ?? primerDia;
  const registros = await prisma.registroAsistencia.findMany({
    where: {
      trabajadorId: datos.trabajador.id,
      obraId: { in: datos.obras.map((obra) => obra.id) },
      fecha: { gte: convertirFechaADate(primerDia), lte: convertirFechaADate(ultimoDia) },
    },
    select: { obraId: true, fecha: true, tipoJornada: true, efectoPago: true },
  });
  const registroPorDia = new Map(
    registros.map((registro) => [`${registro.obraId}|${formatearFecha(registro.fecha)}`, registro]),
  );
  const altaTrabajador = obtenerFechaLocal(datos.trabajador.creadoEn, datos.zona);
  const ayer = sumarDias(datos.hoy, -1);
  const resultado: DiaAsistencia[] = [];

  for (const obra of datos.obras) {
    const filasHorario = await obtenerFilasHorario(obra.id);
    const desde = maximo(formatearFecha(obra.fechaInicio), altaTrabajador);
    const hasta = minimo(formatearFecha(obra.fechaFinal), ayer);

    for (const fecha of dias) {
      const registro = registroPorDia.get(`${obra.id}|${fecha}`);
      if (registro) {
        resultado.push({
          fecha,
          obraId: obra.id,
          color: COLOR_POR_TIPO[registro.tipoJornada],
          tipoJornada: registro.tipoJornada,
          esFaltaCalculada: false,
          conDescuento: esConDescuento(registro.efectoPago),
        });
        continue;
      }
      const dentroDelPeriodo = fecha >= desde && fecha <= hasta;
      if (
        dentroDelPeriodo &&
        resolverHorarioEfectivo(filasHorario, fecha, datos.zona)?.esDiaLaborable
      ) {
        resultado.push({
          fecha,
          obraId: obra.id,
          color: 'ROJO',
          tipoJornada: TipoJornada.FALTA,
          esFaltaCalculada: true,
          conDescuento: false,
        });
      }
    }
  }

  return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Número de faltas (guardadas o calculadas) del trabajador en el mes de "hoy", en todas sus
 * obras de la empresa. Lo muestran la confirmación del escaneo y el paquete sin conexión.
 *
 * @returns Faltas del mes.
 */
export async function contarFaltasDelMes(
  trabajador: { id: string; creadoEn: Date },
  empresaId: string,
  zona: string,
  hoy: string,
): Promise<number> {
  const obras = await obtenerObrasDelTrabajador(trabajador.id, empresaId);
  const dias = await calcularDiasAsistencia({
    trabajador,
    obras,
    mes: hoy.slice(0, LARGO_MES),
    zona,
    hoy,
  });
  return dias.filter((dia) => dia.tipoJornada === TipoJornada.FALTA).length;
}

function maximo(a: string, b: string): string {
  return a > b ? a : b;
}

function minimo(a: string, b: string): string {
  return a < b ? a : b;
}
