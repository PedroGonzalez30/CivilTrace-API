/**
 * @archivo servicioConsultaAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Consultas de asistencia para las pantallas del supervisor y del trabajador: obras
 *   del supervisor, paquete para escanear sin conexión, resumen del día, "Mi asistencia" y foto
 *   del trabajador.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, RNF-07 Captura sin conexión (D-14)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Falta al pasar la hora de salida (feature 006, D-34)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { AlcanceHorario, Rol, TipoJornada } from '@/generated/prisma/enums';
import { contarFaltasDelMes } from '@/servicios/servicioCalendarioAsistencia';
import { obtenerOCrearCredencial } from '@/servicios/servicioCredencialAsistencia';
import { obtenerImagen } from '@/servicios/servicioAlmacenamiento';
import {
  obtenerHorarioEfectivo,
  obtenerHorarioGeneral,
  obtenerZonaHorariaEmpresa,
} from '@/servicios/servicioHorario';
import { construirRutaFoto } from '@/servicios/servicioRegistroAsistencia';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import {
  construirInstante,
  convertirFechaADate,
  convertirHoraAMinutos,
  formatearFecha,
  obtenerFechaLocal,
  obtenerMinutosLocales,
} from '@/utilidades/fechasLocales';
import {
  estaAsignadoAObra,
  exigirSupervisorDeObra,
  exigirSupervisorODueno,
  obtenerObraDeEmpresa,
} from '@/utilidades/permisosObra';

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
const MILISEGUNDOS_POR_MINUTO = 60_000;

// 4. Funciones
/**
 * Obras que supervisa el usuario (pantalla SUP_Asistencia_EscogerObra).
 */
export async function listarObrasSupervisadas(supervisor: DatosTokenAcceso) {
  const obras = await prisma.obra.findMany({
    where: { empresaId: supervisor.empresaId, supervisorId: supervisor.sub },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      direccion: true,
      fechaInicio: true,
      fechaFinal: true,
    },
    orderBy: { nombre: 'asc' },
  });
  return obras.map((obra) => ({
    ...obra,
    fechaInicio: formatearFecha(obra.fechaInicio),
    fechaFinal: formatearFecha(obra.fechaFinal),
  }));
}

/**
 * Datos para validar QR sin conexión (research R-02). Crea la credencial de quien todavía no la
 * tenga, para que todos los asignados se puedan escanear sin señal. Nunca incluye el token.
 *
 * @throws ErrorHttp 404 si la obra no es de la empresa; 403 si no es su supervisor.
 */
export async function obtenerPaqueteSinConexion(supervisor: DatosTokenAcceso, obraId: string) {
  const obra = await obtenerObraDeEmpresa(obraId, supervisor.empresaId);
  exigirSupervisorDeObra(obra, supervisor);
  const ahora = new Date();
  const zona = await obtenerZonaHorariaEmpresa(supervisor.empresaId);
  const hoy = obtenerFechaLocal(ahora, zona);

  const [general, excepcionHoy, asignados] = await Promise.all([
    obtenerHorarioGeneral(obra.id),
    prisma.horarioObra.findFirst({
      where: { obraId: obra.id, alcance: AlcanceHorario.DIA, fecha: convertirFechaADate(hoy) },
      orderBy: { creadoEn: 'desc' },
    }),
    prisma.usuario.findMany({
      where: { empresaId: supervisor.empresaId, obrasAsignadas: { some: { id: obra.id } } },
      select: { id: true, nombre: true, oficio: true, fotoBlob: true, creadoEn: true },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  const trabajadores = [];
  for (const trabajador of asignados) {
    const credencial = await obtenerOCrearCredencial(trabajador.id, supervisor.empresaId);
    trabajadores.push({
      id: trabajador.id,
      nombre: trabajador.nombre,
      oficio: trabajador.oficio,
      fotoUrl: construirRutaFoto(obra.id, trabajador.id, trabajador.fotoBlob),
      huellaCredencial: credencial.tokenHash,
      faltasMes: await contarFaltasDelMes(trabajador, supervisor.empresaId, zona, hoy),
    });
  }

  return {
    generadoEn: ahora.toISOString(),
    zonaHoraria: zona,
    horario: {
      general: general && formatearHorario(general),
      excepcionHoy: excepcionHoy && formatearHorario(excepcionHoy),
    },
    trabajadores,
  };
}

/**
 * Resumen de asistencia de un día en una obra (pantalla SUP_Asistencia_LeerQr).
 *
 * @throws ErrorHttp 404/403 según la obra y el rol.
 */
export async function obtenerResumenDia(
  usuario: DatosTokenAcceso,
  obraId: string,
  fechaPedida?: string,
) {
  const obra = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);
  const ahora = new Date();
  const zona = await obtenerZonaHorariaEmpresa(usuario.empresaId);
  const hoy = obtenerFechaLocal(ahora, zona);
  const fecha = fechaPedida ?? hoy;
  const horario = await obtenerHorarioEfectivo(obra.id, fecha, zona);

  const [asignados, registros] = await Promise.all([
    prisma.usuario.findMany({
      where: { empresaId: usuario.empresaId, obrasAsignadas: { some: { id: obra.id } } },
      select: { id: true, nombre: true, oficio: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.registroAsistencia.findMany({
      where: { obraId: obra.id, fecha: convertirFechaADate(fecha) },
    }),
  ]);
  const registroPorTrabajador = new Map(
    registros.map((registro) => [registro.trabajadorId, registro]),
  );
  const yaPasoElDia = fecha < hoy;
  // D-34: el mismo día, quien no registró entrada es falta en cuanto pasa la hora de salida.
  const pasoLaSalida =
    fecha === hoy &&
    horario !== null &&
    horario !== undefined &&
    obtenerMinutosLocales(ahora, zona) >= convertirHoraAMinutos(horario.horaSalida);
  const esFalta = (yaPasoElDia || pasoLaSalida) && Boolean(horario?.esDiaLaborable);

  return {
    fecha,
    horario,
    estadoEntrada: calcularEstado(horario?.horaEntrada, horario?.toleranciaMinutos ?? 0),
    estadoSalida: calcularEstado(horario?.horaSalida, 0),
    trabajadores: asignados.map((trabajador) => {
      const registro = registroPorTrabajador.get(trabajador.id);
      return {
        id: trabajador.id,
        nombre: trabajador.nombre,
        oficio: trabajador.oficio,
        entrada: registro?.entradaEn?.toISOString() ?? null,
        salida: registro?.salidaEn?.toISOString() ?? null,
        tipoJornada: registro?.tipoJornada ?? (esFalta ? TipoJornada.FALTA : null),
      };
    }),
  };

  // Un estado está "Finalizado" cuando ya pasó su hora (más la tolerancia en la entrada).
  function calcularEstado(
    hora: string | undefined,
    tolerancia: number,
  ): 'FINALIZADO' | 'PENDIENTE' {
    if (!hora) {
      return yaPasoElDia ? 'FINALIZADO' : 'PENDIENTE';
    }
    const limite =
      construirInstante(fecha, hora, zona).getTime() + tolerancia * MILISEGUNDOS_POR_MINUTO;
    return ahora.getTime() > limite ? 'FINALIZADO' : 'PENDIENTE';
  }
}

/**
 * Horario de hoy y estado de entrada y salida en cada obra del trabajador (TRA-Asistencia Dia).
 */
export async function obtenerMiDia(trabajador: DatosTokenAcceso) {
  const zona = await obtenerZonaHorariaEmpresa(trabajador.empresaId);
  const fecha = obtenerFechaLocal(new Date(), zona);
  const obras = await prisma.obra.findMany({
    where: { empresaId: trabajador.empresaId, trabajadores: { some: { id: trabajador.sub } } },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
  const registros = await prisma.registroAsistencia.findMany({
    where: { trabajadorId: trabajador.sub, fecha: convertirFechaADate(fecha) },
  });

  const resultado = [];
  for (const obra of obras) {
    const horario = await obtenerHorarioEfectivo(obra.id, fecha, zona);
    const registro = registros.find((fila) => fila.obraId === obra.id);
    resultado.push({
      obraId: obra.id,
      obraNombre: obra.nombre,
      horaEntrada: horario?.horaEntrada ?? null,
      horaSalida: horario?.horaSalida ?? null,
      esDiaLaborable: horario?.esDiaLaborable ?? false,
      entrada: describirMarca(registro?.entradaEn ?? null),
      salida: describirMarca(registro?.salidaEn ?? null),
    });
  }
  return { fecha, obras: resultado };
}

/**
 * Foto de perfil de un trabajador asignado a la obra, para la confirmación del escaneo.
 *
 * @throws ErrorHttp 404 si no está asignado o no tiene foto; 403 si no es supervisor o dueño.
 */
export async function obtenerFotoTrabajador(
  usuario: DatosTokenAcceso,
  obraId: string,
  trabajadorId: string,
) {
  const obra = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  exigirSupervisorODueno(obra, usuario);
  const trabajador = await prisma.usuario.findFirst({
    where: { id: trabajadorId, empresaId: usuario.empresaId, rol: Rol.TRABAJADOR },
    select: { fotoBlob: true },
  });
  if (!trabajador?.fotoBlob || !(await estaAsignadoAObra(trabajadorId, obra.id))) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'El trabajador no tiene foto');
  }
  return obtenerImagen(trabajador.fotoBlob);
}

// 5. Funciones privadas
function describirMarca(hora: Date | null) {
  return { estado: hora ? 'REGISTRADA' : 'PENDIENTE', hora: hora?.toISOString() ?? null };
}

function formatearHorario(horario: {
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  diasLaborales: number[];
  creadoEn: Date;
  fecha?: Date | null;
}) {
  return {
    horaEntrada: horario.horaEntrada,
    horaSalida: horario.horaSalida,
    toleranciaMinutos: horario.toleranciaMinutos,
    diasLaborales: horario.diasLaborales,
    actualizadoEn: horario.creadoEn.toISOString(),
    ...(horario.fecha ? { fecha: formatearFecha(horario.fecha) } : {}),
  };
}
