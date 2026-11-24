/**
 * @archivo servicioDetallesAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion "Detalles de asistencia" de un trabajador en un día: consultar (con historial) y
 *   editar tipo de jornada, motivo, efecto en el pago, observación y horas. Cada cambio guarda el
 *   valor anterior, el autor y la fecha.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada, RF-58 Mostrar calendario de
 *   asistencia, D-07
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-09)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import type { DatosEditarDetalles } from '@/esquemas/esquemasAsistencia';
import { EfectoPago, Rol, TipoJornada } from '@/generated/prisma/enums';
import { calcularDiasAsistencia, esConDescuento } from '@/servicios/servicioCalendarioAsistencia';
import { obtenerHorarioEfectivo, obtenerZonaHorariaEmpresa } from '@/servicios/servicioHorario';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import { convertirFechaADate, obtenerFechaLocal } from '@/utilidades/fechasLocales';
import {
  estaAsignadoAObra,
  exigirSupervisorDeObra,
  exigirSupervisorODueno,
  obtenerObraDeEmpresa,
  type ObraBasica,
} from '@/utilidades/permisosObra';

// 2. Tipos e interfaces
type CampoEditable =
  'tipoJornada' | 'motivo' | 'efectoPago' | 'anotacion' | 'entradaEn' | 'salidaEn';

// 3. Constantes del módulo
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_PROHIBIDO = 403;
const CODIGO_NO_ENCONTRADO = 404;
const LARGO_MES = 7;
const CAMPOS_EDITABLES: CampoEditable[] = [
  'tipoJornada',
  'motivo',
  'efectoPago',
  'anotacion',
  'entradaEn',
  'salidaEn',
];
const INCLUIR_DETALLE = {
  entradaRegistradaPor: { select: { nombre: true } },
  salidaRegistradaPor: { select: { nombre: true } },
  cambios: { include: { autor: { select: { nombre: true } } }, orderBy: { creadoEn: 'asc' } },
} as const;

// 4. Funciones públicas
/**
 * Detalle del día de un trabajador en una obra. Lo pueden ver el supervisor de la obra, el dueño
 * y el propio trabajador.
 *
 * @throws ErrorHttp 404 si la obra o el trabajador no existen en la empresa; 403 sin permiso.
 */
export async function obtenerDetalleDia(
  usuario: DatosTokenAcceso,
  obraId: string,
  trabajadorId: string,
  fecha: string,
) {
  const obra = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  const esElPropio = usuario.rol === Rol.TRABAJADOR && usuario.sub === trabajadorId;
  if (!esElPropio) {
    if (usuario.rol === Rol.TRABAJADOR) {
      throw new ErrorHttp(CODIGO_PROHIBIDO, 'No tienes permiso para realizar esta acción');
    }
    exigirSupervisorODueno(obra, usuario);
  }
  return armarDetalle(obra, trabajadorId, fecha, usuario.empresaId);
}

/**
 * Edita el día de un trabajador (solo el supervisor de la obra). Si el día no tenía registro, lo
 * crea (FR-018). La observación es obligatoria si la jornada no queda "Completa" (RF-60).
 *
 * @throws ErrorHttp 400 por datos inválidos, 403 si no es el supervisor, 404 si no está asignado.
 */
export async function editarDetalleDia(
  supervisor: DatosTokenAcceso,
  obraId: string,
  trabajadorId: string,
  fecha: string,
  cambios: DatosEditarDetalles,
) {
  const obra = await obtenerObraDeEmpresa(obraId, supervisor.empresaId);
  exigirSupervisorDeObra(obra, supervisor);
  if (!(await estaAsignadoAObra(trabajadorId, obra.id))) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'El trabajador no está asignado a esta obra');
  }
  const zona = await obtenerZonaHorariaEmpresa(supervisor.empresaId);
  if (fecha > obtenerFechaLocal(new Date(), zona)) {
    throw new ErrorHttp(
      CODIGO_PETICION_INVALIDA,
      'No se puede registrar asistencia en una fecha futura',
    );
  }

  const clave = { trabajadorId, obraId: obra.id, fecha: convertirFechaADate(fecha) };
  const existente = await prisma.registroAsistencia.findUnique({
    where: { trabajadorId_obraId_fecha: clave },
  });
  const anterior = {
    tipoJornada: existente?.tipoJornada ?? null,
    motivo: existente?.motivo ?? null,
    efectoPago: existente?.efectoPago ?? EfectoPago.PAGO_COMPLETO,
    anotacion: existente?.anotacion ?? null,
    entradaEn: existente?.entradaEn ?? null,
    salidaEn: existente?.salidaEn ?? null,
  };
  const entradaNueva =
    cambios.entradaEn !== undefined ? convertirInstante(cambios.entradaEn) : anterior.entradaEn;
  // Un día nuevo sin entrada es una falta; con entrada, una jornada completa.
  const tipoPorDefecto = entradaNueva ? TipoJornada.COMPLETA : TipoJornada.FALTA;
  const nuevo = {
    tipoJornada: cambios.tipoJornada ?? anterior.tipoJornada ?? tipoPorDefecto,
    motivo: cambios.motivo !== undefined ? cambios.motivo : anterior.motivo,
    efectoPago: cambios.efectoPago ?? anterior.efectoPago,
    anotacion: cambios.anotacion !== undefined ? cambios.anotacion : anterior.anotacion,
    entradaEn: entradaNueva,
    salidaEn:
      cambios.salidaEn !== undefined ? convertirInstante(cambios.salidaEn) : anterior.salidaEn,
  };
  validarNuevoEstado(nuevo, fecha, zona);

  const camposCambiados = CAMPOS_EDITABLES.filter(
    (campo) => aTexto(anterior[campo]) !== aTexto(nuevo[campo]),
  );
  if (existente && camposCambiados.length === 0) {
    return armarDetalle(obra, trabajadorId, fecha, supervisor.empresaId);
  }

  const horario = existente ? null : await obtenerHorarioEfectivo(obra.id, fecha, zona);
  await prisma.$transaction(async (transaccion) => {
    const registro = existente
      ? await transaccion.registroAsistencia.update({ where: { id: existente.id }, data: nuevo })
      : await transaccion.registroAsistencia.create({
          data: {
            ...clave,
            empresaId: supervisor.empresaId,
            ...nuevo,
            esDiaLaborable: horario?.esDiaLaborable ?? false,
            horarioEntrada: horario?.horaEntrada ?? null,
            horarioSalida: horario?.horaSalida ?? null,
            toleranciaMinutos: horario?.toleranciaMinutos ?? null,
          },
        });
    await transaccion.cambioAsistencia.createMany({
      data: camposCambiados.map((campo) => ({
        registroId: registro.id,
        campo,
        valorAnterior: aTexto(anterior[campo]),
        valorNuevo: aTexto(nuevo[campo]),
        motivo: nuevo.anotacion,
        autorId: supervisor.sub,
      })),
    });
  });

  return armarDetalle(obra, trabajadorId, fecha, supervisor.empresaId);
}

// 5. Funciones privadas
function validarNuevoEstado(
  nuevo: {
    tipoJornada: TipoJornada;
    anotacion: string | null;
    entradaEn: Date | null;
    salidaEn: Date | null;
  },
  fecha: string,
  zona: string,
): void {
  if (nuevo.tipoJornada !== TipoJornada.COMPLETA && !nuevo.anotacion) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'La observación es obligatoria');
  }
  if (nuevo.salidaEn && !nuevo.entradaEn) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Registra primero la hora de entrada');
  }
  if (nuevo.entradaEn && nuevo.salidaEn && nuevo.salidaEn <= nuevo.entradaEn) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'La salida debe ser posterior a la entrada');
  }
  for (const hora of [nuevo.entradaEn, nuevo.salidaEn]) {
    if (hora && obtenerFechaLocal(hora, zona) !== fecha) {
      throw new ErrorHttp(CODIGO_PETICION_INVALIDA, 'Las horas deben ser del mismo día');
    }
  }
}

async function armarDetalle(
  obra: ObraBasica,
  trabajadorId: string,
  fecha: string,
  empresaId: string,
) {
  const trabajador = await prisma.usuario.findFirst({
    where: { id: trabajadorId, empresaId },
    select: { id: true, nombre: true, oficio: true, creadoEn: true },
  });
  if (!trabajador) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'El trabajador no existe');
  }
  const registro = await prisma.registroAsistencia.findUnique({
    where: {
      trabajadorId_obraId_fecha: {
        trabajadorId,
        obraId: obra.id,
        fecha: convertirFechaADate(fecha),
      },
    },
    include: INCLUIR_DETALLE,
  });
  const base = {
    fecha,
    trabajador: { id: trabajador.id, nombre: trabajador.nombre, oficio: trabajador.oficio },
    obra: { id: obra.id, nombre: obra.nombre },
  };

  if (!registro) {
    const esFaltaCalculada = await esFaltaCalculadaDelDia(obra.id, trabajador, fecha, empresaId);
    return {
      ...base,
      entrada: null,
      salida: null,
      tipoJornada: esFaltaCalculada ? TipoJornada.FALTA : null,
      esFaltaCalculada,
      motivo: null,
      efectoPago: EfectoPago.PAGO_COMPLETO,
      conDescuento: false,
      anotacion: null,
      registradoPor: null,
      registradoEn: null,
      cambios: [],
    };
  }

  const primerAutor = registro.cambios[0]?.autor.nombre ?? null;
  return {
    ...base,
    entrada: registro.entradaEn && {
      hora: registro.entradaEn.toISOString(),
      sinConexion: registro.entradaSinConexion,
      latitud: aNumero(registro.entradaLatitud),
      longitud: aNumero(registro.entradaLongitud),
      registradaPor: registro.entradaRegistradaPor?.nombre ?? null,
    },
    salida: registro.salidaEn && {
      hora: registro.salidaEn.toISOString(),
      sinConexion: registro.salidaSinConexion,
      latitud: aNumero(registro.salidaLatitud),
      longitud: aNumero(registro.salidaLongitud),
      registradaPor: registro.salidaRegistradaPor?.nombre ?? null,
    },
    tipoJornada: registro.tipoJornada,
    esFaltaCalculada: false,
    motivo: registro.motivo,
    efectoPago: registro.efectoPago,
    conDescuento: esConDescuento(registro.efectoPago),
    anotacion: registro.anotacion,
    registradoPor: registro.entradaRegistradaPor?.nombre ?? primerAutor,
    registradoEn: (registro.entradaEn ?? registro.creadoEn).toISOString(),
    cambios: registro.cambios.map((cambio) => ({
      campo: cambio.campo,
      valorAnterior: cambio.valorAnterior,
      valorNuevo: cambio.valorNuevo,
      autor: cambio.autor.nombre,
      fecha: cambio.creadoEn.toISOString(),
    })),
  };
}

async function esFaltaCalculadaDelDia(
  obraId: string,
  trabajador: { id: string; creadoEn: Date },
  fecha: string,
  empresaId: string,
): Promise<boolean> {
  const obra = await prisma.obra.findUniqueOrThrow({
    where: { id: obraId },
    select: { id: true, fechaInicio: true, fechaFinal: true },
  });
  const zona = await obtenerZonaHorariaEmpresa(empresaId);
  const dias = await calcularDiasAsistencia({
    trabajador,
    obras: [obra],
    mes: fecha.slice(0, LARGO_MES),
    zona,
    hoy: obtenerFechaLocal(new Date(), zona),
  });
  return dias.some((dia) => dia.fecha === fecha && dia.esFaltaCalculada);
}

function convertirInstante(valor: string | null): Date | null {
  return valor === null ? null : new Date(valor);
}

function aTexto(valor: Date | string | null): string | null {
  if (valor === null) {
    return null;
  }
  return valor instanceof Date ? valor.toISOString() : valor;
}

function aNumero(valor: { toString(): string } | null): number | null {
  return valor === null ? null : Number(valor.toString());
}
