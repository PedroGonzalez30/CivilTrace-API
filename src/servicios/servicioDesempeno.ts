/**
 * @archivo servicioDesempeno.ts
 * @proyecto Civil Trace
 * @descripcion Métricas de desempeño de un trabajador por periodo (semana, mes o todo): asistencia,
 *   evidencias aceptadas, actividades entregadas a tiempo y actividades aprobadas (D-30).
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-31 Calcular aprobación de actividades por trabajador, RF-61 Calcular retardos,
 *   RF-62 Calcular entregas a tiempo, RF-63 Calcular rechazo de evidencias, RF-64 Mostrar métricas
 *   de desempeño (SRS V4.0; D-30)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 005)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import {
  EstadoActividad,
  EstadoAvance,
  Rol,
  TipoAvance,
  TipoJornada,
} from '@/generated/prisma/enums';
import {
  calcularDiasAsistencia,
  obtenerObrasDelTrabajador,
} from '@/servicios/servicioCalendarioAsistencia';
import { obtenerZonaHorariaEmpresa } from '@/servicios/servicioHorario';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import {
  construirInstante,
  convertirFechaADate,
  obtenerDiaSemana,
  obtenerFechaLocal,
  sumarDias,
} from '@/utilidades/fechasLocales';

// 2. Tipos e interfaces
export type Periodo = 'SEMANA' | 'MES' | 'TODO';

export interface Desempeno {
  trabajador: { id: string; nombre: string; oficio: string | null };
  periodo: { tipo: Periodo; desde: string; hasta: string };
  asistencia: {
    porcentaje: number | null;
    completos: number;
    total: number;
    retardos: number;
    mediasJornadas: number;
    salidasTempranas: number;
    faltas: number;
  };
  evidencias: {
    porcentaje: number | null;
    aprobadas: number;
    rechazadas: number;
    pendientes: number;
  };
  actividadesEntregadas: { total: number; antes: number; mismoDia: number; conRetraso: number };
  actividadesAprobadas: { porcentaje: number | null; aprobadas: number; rechazadas: number };
}

// 3. Constantes del módulo
const CODIGO_PROHIBIDO = 403;
const CODIGO_NO_ENCONTRADO = 404;
const DIAS_DESDE_LUNES = [6, 0, 1, 2, 3, 4, 5];
const LARGO_MES = 7;
const CIEN = 100;

// 4. Funciones privadas
function calcularPorcentaje(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * CIEN);
}

/** Primer día del periodo en fechas locales; "Todo" empieza el día del alta del trabajador. */
function calcularInicio(periodo: Periodo, hoy: string, alta: string): string {
  if (periodo === 'SEMANA') {
    return sumarDias(hoy, -(DIAS_DESDE_LUNES[obtenerDiaSemana(hoy)] ?? 0));
  }
  if (periodo === 'MES') {
    return `${hoy.slice(0, LARGO_MES)}-01`;
  }
  return alta;
}

/** Meses YYYY-MM que toca el periodo, para reutilizar el cálculo del calendario (RF-58). */
function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let [anio = 0, mes = 1] = desde.split('-').map(Number);
  const fin = hasta.slice(0, LARGO_MES);
  for (;;) {
    const actual = `${anio}-${String(mes).padStart(2, '0')}`;
    meses.push(actual);
    if (actual >= fin) {
      return meses;
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
}

// 5. Funciones públicas
/**
 * Métricas de desempeño de un trabajador (D-30). El dueño ve las de cualquier trabajador de su
 * empresa; el supervisor, solo con los datos de sus obras; el trabajador no tiene acceso.
 *
 * @param usuario - Datos del token.
 * @param trabajadorId - Trabajador consultado.
 * @param periodo - SEMANA, MES o TODO.
 * @returns Las cuatro tarjetas de la pantalla DesempenoTrabajador.
 * @throws ErrorHttp 404 si el trabajador no es de la empresa; 403 sin permiso.
 */
export async function obtenerDesempeno(
  usuario: DatosTokenAcceso,
  trabajadorId: string,
  periodo: Periodo,
): Promise<Desempeno> {
  if (usuario.rol === Rol.TRABAJADOR) {
    throw new ErrorHttp(CODIGO_PROHIBIDO, 'No tienes permiso para ver estas métricas');
  }
  const trabajador = await prisma.usuario.findFirst({
    where: { id: trabajadorId, empresaId: usuario.empresaId, rol: Rol.TRABAJADOR },
    select: { id: true, nombre: true, oficio: true, creadoEn: true },
  });
  if (!trabajador) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'El trabajador no existe');
  }

  let obras = await obtenerObrasDelTrabajador(trabajador.id, usuario.empresaId);
  if (usuario.rol === Rol.SUPERVISOR) {
    obras = obras.filter((obra) => obra.supervisorId === usuario.sub);
    if (obras.length === 0) {
      throw new ErrorHttp(CODIGO_PROHIBIDO, 'No tienes permiso para ver estas métricas');
    }
  }
  const idsObras = obras.map((obra) => obra.id);

  const zona = await obtenerZonaHorariaEmpresa(usuario.empresaId);
  const hoy = obtenerFechaLocal(new Date(), zona);
  const alta = obtenerFechaLocal(trabajador.creadoEn, zona);
  const desde = calcularInicio(periodo, hoy, alta);
  const inicio = construirInstante(desde, '00:00', zona);
  const fin = construirInstante(sumarDias(hoy, 1), '00:00', zona);

  // Asistencia: los mismos días con color del calendario, recortados al periodo.
  const dias = [];
  for (const mes of mesesEntre(desde, hoy)) {
    dias.push(...(await calcularDiasAsistencia({ trabajador, obras, mes, zona, hoy })));
  }
  const diasPeriodo = dias.filter((dia) => dia.fecha >= desde && dia.fecha <= hoy);
  const contar = (tipo: TipoJornada) =>
    diasPeriodo.filter((dia) => dia.tipoJornada === tipo).length;
  const completos = contar(TipoJornada.COMPLETA);

  const avances = await prisma.avanceActividad.groupBy({
    by: ['estado'],
    where: {
      empresaId: usuario.empresaId,
      registradoPorId: trabajador.id,
      fechaRegistro: { gte: inicio, lt: fin },
      actividad: { obraId: { in: idsObras } },
    },
    _count: { _all: true },
  });
  const contarAvances = (estado: EstadoAvance) =>
    avances.find((grupo) => grupo.estado === estado)?._count._all ?? 0;
  const aprobadas = contarAvances(EstadoAvance.APROBADO);
  const rechazadas = contarAvances(EstadoAvance.RECHAZADO);

  const terminadas = await prisma.actividad.findMany({
    where: {
      empresaId: usuario.empresaId,
      obraId: { in: idsObras },
      responsableId: trabajador.id,
      estado: EstadoActividad.TERMINADA,
      fechaTerminada: { gte: convertirFechaADate(desde), lte: convertirFechaADate(hoy) },
    },
    select: { fechaEntrega: true, fechaTerminada: true },
  });
  const compararEntrega = (signo: -1 | 0 | 1) =>
    terminadas.filter((actividad) => {
      const diferencia =
        (actividad.fechaTerminada?.getTime() ?? 0) - actividad.fechaEntrega.getTime();
      return Math.sign(diferencia) === signo;
    }).length;

  const revisionesTerminado = await prisma.avanceActividad.groupBy({
    by: ['estado'],
    where: {
      empresaId: usuario.empresaId,
      registradoPorId: trabajador.id,
      tipo: TipoAvance.TERMINADO,
      estado: { in: [EstadoAvance.APROBADO, EstadoAvance.RECHAZADO] },
      revisadoEn: { gte: inicio, lt: fin },
      actividad: { obraId: { in: idsObras } },
    },
    _count: { _all: true },
  });
  const contarRevisiones = (estado: EstadoAvance) =>
    revisionesTerminado.find((grupo) => grupo.estado === estado)?._count._all ?? 0;
  const actividadesAprobadas = contarRevisiones(EstadoAvance.APROBADO);
  const actividadesRechazadas = contarRevisiones(EstadoAvance.RECHAZADO);

  return {
    trabajador: { id: trabajador.id, nombre: trabajador.nombre, oficio: trabajador.oficio },
    periodo: { tipo: periodo, desde, hasta: hoy },
    asistencia: {
      porcentaje: calcularPorcentaje(completos, diasPeriodo.length),
      completos,
      total: diasPeriodo.length,
      retardos: contar(TipoJornada.RETARDO),
      mediasJornadas: contar(TipoJornada.MEDIA_JORNADA),
      salidasTempranas: contar(TipoJornada.SALIDA_TEMPRANA),
      faltas: contar(TipoJornada.FALTA),
    },
    evidencias: {
      porcentaje: calcularPorcentaje(aprobadas, aprobadas + rechazadas),
      aprobadas,
      rechazadas,
      pendientes: contarAvances(EstadoAvance.PENDIENTE),
    },
    actividadesEntregadas: {
      total: terminadas.length,
      antes: compararEntrega(-1),
      mismoDia: compararEntrega(0),
      conRetraso: compararEntrega(1),
    },
    actividadesAprobadas: {
      porcentaje: calcularPorcentaje(
        actividadesAprobadas,
        actividadesAprobadas + actividadesRechazadas,
      ),
      aprobadas: actividadesAprobadas,
      rechazadas: actividadesRechazadas,
    },
  };
}
