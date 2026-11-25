/**
 * @archivo servicioRegistroAsistencia.ts
 * @proyecto Civil Trace
 * @descripcion Registro de entrada y salida por escaneo del QR: clasificación de la jornada,
 *   procesamiento de lotes (con y sin conexión, idempotentes) y vista previa del escaneo.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.1.0
 * @requerimientos RF-19 Registrar asistencia propia, RF-27 Registrar asistencia por el
 *   supervisor, RF-60 Registrar retardo o salida anticipada, RNF-07 Captura sin conexión (D-14)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-03, R-04,
 *   R-07)
 *   24/11/2026 - Emilio Manuel Esquivel - Entrada desde la hora de salida = falta (D-22)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import {
  MAXIMO_DIAS_REGISTRO_SIN_CONEXION,
  MAXIMO_MINUTOS_EN_FUTURO,
} from '@/constantes/asistencia';
import type { DatosEscaneo } from '@/esquemas/esquemasAsistencia';
import { Prisma } from '@/generated/prisma/client';
import { TipoJornada } from '@/generated/prisma/enums';
import { contarFaltasDelMes } from '@/servicios/servicioCalendarioAsistencia';
import { resolverCodigoQr } from '@/servicios/servicioCredencialAsistencia';
import { obtenerHorarioEfectivo, obtenerZonaHorariaEmpresa } from '@/servicios/servicioHorario';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';
import {
  convertirFechaADate,
  convertirHoraAMinutos,
  formatearFecha,
  obtenerFechaLocal,
  obtenerMinutosLocales,
  restarInstantesEnMinutos,
} from '@/utilidades/fechasLocales';
import {
  esSupervisorDeObra,
  estaAsignadoAObra,
  exigirSupervisorDeObra,
  obtenerObraDeEmpresa,
} from '@/utilidades/permisosObra';

// 2. Tipos e interfaces
export type MotivoRechazo =
  | 'QR_INVALIDO'
  | 'NO_ASIGNADO'
  | 'NO_ES_SUPERVISOR'
  | 'ASISTENCIA_COMPLETA'
  | 'FECHA_FUERA_DE_RANGO';

type TipoRegistro = 'ENTRADA' | 'SALIDA';

interface HorarioParaClasificar {
  horaEntrada: string;
  horaSalida: string;
  toleranciaMinutos: number;
  esDiaLaborable: boolean;
}

interface DatosClasificacion {
  entradaMinutos: number;
  salidaMinutos?: number;
  horario: HorarioParaClasificar | null;
  tipoActual?: TipoJornada;
}

interface RegistroResumido {
  id: string;
  trabajadorId: string;
  fecha: string;
  tipo: TipoRegistro;
  hora: string;
  tipoJornada: TipoJornada;
}

export interface ResultadoEscaneo {
  idLocal: string;
  estado: 'GUARDADO' | 'DUPLICADO' | 'RECHAZADO';
  motivo: MotivoRechazo | null;
  mensaje: string | null;
  registro: RegistroResumido | null;
}

// 3. Constantes del módulo
const CODIGO_DATOS_NO_PROCESABLES = 422;
const CODIGO_PRISMA_UNICO = 'P2002';
const MINUTOS_POR_DIA = 24 * 60;
const MENSAJES: Record<MotivoRechazo, string> = {
  QR_INVALIDO: 'El código no es de Civil Trace o ya no es válido',
  NO_ASIGNADO: 'El trabajador no está asignado a esta obra',
  NO_ES_SUPERVISOR: 'Solo el supervisor de la obra puede registrar asistencia',
  ASISTENCIA_COMPLETA: 'La asistencia de hoy ya está completa',
  FECHA_FUERA_DE_RANGO: 'La hora del escaneo no es válida',
};

class RechazoEscaneo extends Error {
  constructor(readonly motivo: MotivoRechazo) {
    super(MENSAJES[motivo]);
  }
}

// 4. Funciones públicas
/**
 * Clasifica la jornada con el horario del día (research R-07). Sin horario o en día no laborable
 * no clasifica. Justo en el límite de la tolerancia no es retardo (SC-006). Una entrada desde la
 * hora de salida ya no es retardo sino falta (D-22): el trabajador no estuvo en su jornada.
 *
 * @returns El tipo de jornada resultante.
 */
export function clasificarJornada(datos: DatosClasificacion): TipoJornada {
  const tipoActual = datos.tipoActual ?? TipoJornada.COMPLETA;
  if (!datos.horario || !datos.horario.esDiaLaborable) {
    return tipoActual;
  }

  if (datos.salidaMinutos === undefined) {
    if (datos.entradaMinutos >= convertirHoraAMinutos(datos.horario.horaSalida)) {
      return TipoJornada.FALTA;
    }
    const limiteEntrada =
      convertirHoraAMinutos(datos.horario.horaEntrada) + datos.horario.toleranciaMinutos;
    return datos.entradaMinutos > limiteEntrada ? TipoJornada.RETARDO : TipoJornada.COMPLETA;
  }

  const saleAntes = datos.salidaMinutos < convertirHoraAMinutos(datos.horario.horaSalida);
  return tipoActual === TipoJornada.COMPLETA && saleAntes
    ? TipoJornada.SALIDA_TEMPRANA
    : tipoActual;
}

/**
 * Procesa un lote de escaneos en orden. Cada escaneo es independiente: uno rechazado no detiene
 * a los demás. Reenviar un escaneo con el mismo idLocal no crea otro registro.
 *
 * @param supervisor - Datos del token.
 * @param escaneos - Escaneos validados con esquemaLoteEscaneos.
 * @returns Un resultado por escaneo, en el mismo orden.
 */
export async function procesarLoteEscaneos(
  supervisor: DatosTokenAcceso,
  escaneos: DatosEscaneo[],
): Promise<ResultadoEscaneo[]> {
  const resultados: ResultadoEscaneo[] = [];
  for (const escaneo of escaneos) {
    resultados.push(await procesarEscaneo(supervisor, escaneo));
  }
  return resultados;
}

/**
 * Valida un QR con conexión y devuelve lo que la app muestra para confirmar, sin guardar nada.
 *
 * @throws ErrorHttp 404/403 por la obra; 422 con motivo si el QR no se puede registrar.
 */
export async function obtenerVistaPrevia(
  usuario: DatosTokenAcceso,
  obraId: string,
  codigoQr: string,
) {
  const obra = await obtenerObraDeEmpresa(obraId, usuario.empresaId);
  exigirSupervisorDeObra(obra, usuario);
  const ahora = new Date();
  const zona = await obtenerZonaHorariaEmpresa(usuario.empresaId);

  try {
    const trabajadorId = await validarPortador(codigoQr, usuario.empresaId, obraId);
    const fecha = obtenerFechaLocal(ahora, zona);
    const registro = await prisma.registroAsistencia.findUnique({
      where: {
        trabajadorId_obraId_fecha: { trabajadorId, obraId, fecha: convertirFechaADate(fecha) },
      },
      select: { entradaEn: true, salidaEn: true },
    });
    if (registro?.entradaEn && registro.salidaEn) {
      throw new RechazoEscaneo('ASISTENCIA_COMPLETA');
    }
    const trabajador = await prisma.usuario.findUniqueOrThrow({
      where: { id: trabajadorId },
      select: { id: true, nombre: true, oficio: true, fotoBlob: true, creadoEn: true },
    });

    return {
      tipo: (registro?.entradaEn ? 'SALIDA' : 'ENTRADA') as TipoRegistro,
      hora: ahora.toISOString(),
      trabajador: {
        id: trabajador.id,
        nombre: trabajador.nombre,
        oficio: trabajador.oficio,
        fotoUrl: construirRutaFoto(obraId, trabajador.id, trabajador.fotoBlob),
        faltasMes: await contarFaltasDelMes(trabajador, usuario.empresaId, zona, fecha),
      },
    };
  } catch (error) {
    if (error instanceof RechazoEscaneo) {
      throw new ErrorHttp(CODIGO_DATOS_NO_PROCESABLES, error.message, undefined, error.motivo);
    }
    throw error;
  }
}

/**
 * Ruta de la API que sirve la foto del trabajador (research R-11), o null si no tiene.
 */
export function construirRutaFoto(
  obraId: string,
  trabajadorId: string,
  fotoBlob: string | null,
): string | null {
  return fotoBlob ? `/obras/${obraId}/asistencia/trabajadores/${trabajadorId}/foto` : null;
}

// 5. Funciones privadas
async function procesarEscaneo(
  supervisor: DatosTokenAcceso,
  escaneo: DatosEscaneo,
): Promise<ResultadoEscaneo> {
  const duplicado = await buscarDuplicado(escaneo.idLocal);
  if (duplicado) {
    return {
      idLocal: escaneo.idLocal,
      estado: 'DUPLICADO',
      motivo: null,
      mensaje: null,
      registro: duplicado,
    };
  }

  try {
    const registro = await guardarEscaneo(supervisor, escaneo);
    return { idLocal: escaneo.idLocal, estado: 'GUARDADO', motivo: null, mensaje: null, registro };
  } catch (error) {
    if (error instanceof RechazoEscaneo) {
      return {
        idLocal: escaneo.idLocal,
        estado: 'RECHAZADO',
        motivo: error.motivo,
        mensaje: error.message,
        registro: null,
      };
    }
    // Dos envíos simultáneos del mismo idLocal: el segundo choca con la restricción única.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === CODIGO_PRISMA_UNICO
    ) {
      const existente = await buscarDuplicado(escaneo.idLocal);
      if (existente) {
        return {
          idLocal: escaneo.idLocal,
          estado: 'DUPLICADO',
          motivo: null,
          mensaje: null,
          registro: existente,
        };
      }
    }
    throw error;
  }
}

async function guardarEscaneo(
  supervisor: DatosTokenAcceso,
  escaneo: DatosEscaneo,
): Promise<RegistroResumido> {
  const obra = await prisma.obra.findFirst({
    where: { id: escaneo.obraId, empresaId: supervisor.empresaId },
    select: { id: true, nombre: true, empresaId: true, supervisorId: true, fechaInicio: true },
  });
  if (!obra || !esSupervisorDeObra(obra, supervisor)) {
    throw new RechazoEscaneo('NO_ES_SUPERVISOR');
  }
  const trabajadorId = await validarPortador(escaneo.codigoQr, supervisor.empresaId, obra.id);
  const hora = obtenerHoraDelEscaneo(escaneo);
  const zona = await obtenerZonaHorariaEmpresa(supervisor.empresaId);
  const fecha = obtenerFechaLocal(hora, zona);
  const minutos = obtenerMinutosLocales(hora, zona);
  const clave = { trabajadorId, obraId: obra.id, fecha: convertirFechaADate(fecha) };
  const ubicacion = { latitud: escaneo.latitud, longitud: escaneo.longitud };

  return prisma.$transaction(async (transaccion) => {
    const existente = await transaccion.registroAsistencia.findUnique({
      where: { trabajadorId_obraId_fecha: clave },
    });

    if (!existente?.entradaEn) {
      const horario = await obtenerHorarioEfectivo(obra.id, fecha, zona);
      const datosEntrada = {
        entradaEn: hora,
        entradaLatitud: ubicacion.latitud,
        entradaLongitud: ubicacion.longitud,
        entradaSinConexion: escaneo.sinConexion,
        entradaIdLocal: escaneo.idLocal,
        entradaRegistradaPorId: supervisor.sub,
        tipoJornada: clasificarJornada({ entradaMinutos: minutos, horario }),
        esDiaLaborable: horario?.esDiaLaborable ?? false,
        horarioEntrada: horario?.horaEntrada ?? null,
        horarioSalida: horario?.horaSalida ?? null,
        toleranciaMinutos: horario?.toleranciaMinutos ?? null,
      };
      const guardado = existente
        ? await transaccion.registroAsistencia.update({
            where: { id: existente.id },
            data: datosEntrada,
          })
        : await transaccion.registroAsistencia.create({
            data: { ...clave, empresaId: supervisor.empresaId, ...datosEntrada },
          });
      return resumir(guardado, 'ENTRADA', hora);
    }

    if (existente.salidaEn) {
      throw new RechazoEscaneo('ASISTENCIA_COMPLETA');
    }
    if (hora <= existente.entradaEn) {
      throw new RechazoEscaneo('FECHA_FUERA_DE_RANGO');
    }
    const horarioGuardado =
      existente.horarioEntrada && existente.horarioSalida
        ? {
            horaEntrada: existente.horarioEntrada,
            horaSalida: existente.horarioSalida,
            toleranciaMinutos: existente.toleranciaMinutos ?? 0,
            esDiaLaborable: existente.esDiaLaborable,
          }
        : null;
    const guardado = await transaccion.registroAsistencia.update({
      where: { id: existente.id },
      data: {
        salidaEn: hora,
        salidaLatitud: ubicacion.latitud,
        salidaLongitud: ubicacion.longitud,
        salidaSinConexion: escaneo.sinConexion,
        salidaIdLocal: escaneo.idLocal,
        salidaRegistradaPorId: supervisor.sub,
        tipoJornada: clasificarJornada({
          entradaMinutos: obtenerMinutosLocales(existente.entradaEn, zona),
          salidaMinutos: minutos,
          horario: horarioGuardado,
          tipoActual: existente.tipoJornada,
        }),
      },
    });
    return resumir(guardado, 'SALIDA', hora);
  });
}

// Comprueba que el QR sea de un trabajador vigente de la empresa y asignado a la obra. Un QR de
// otra empresa se trata como inválido para no revelar que existe.
async function validarPortador(
  codigoQr: string,
  empresaId: string,
  obraId: string,
): Promise<string> {
  const portador = await resolverCodigoQr(codigoQr);
  if (!portador || portador.empresaId !== empresaId) {
    throw new RechazoEscaneo('QR_INVALIDO');
  }
  if (!(await estaAsignadoAObra(portador.trabajadorId, obraId))) {
    throw new RechazoEscaneo('NO_ASIGNADO');
  }
  return portador.trabajadorId;
}

// Con conexión manda la hora del servidor; sin conexión, la del teléfono dentro de un rango
// razonable (research R-04).
function obtenerHoraDelEscaneo(escaneo: DatosEscaneo): Date {
  const ahora = new Date();
  if (!escaneo.sinConexion) {
    return ahora;
  }
  const capturado = new Date(escaneo.capturadoEn);
  const minutosDesdeCaptura = restarInstantesEnMinutos(capturado, ahora);
  const esFuturo = minutosDesdeCaptura < -MAXIMO_MINUTOS_EN_FUTURO;
  const esMuyViejo = minutosDesdeCaptura > MAXIMO_DIAS_REGISTRO_SIN_CONEXION * MINUTOS_POR_DIA;
  if (esFuturo || esMuyViejo) {
    throw new RechazoEscaneo('FECHA_FUERA_DE_RANGO');
  }
  return capturado;
}

async function buscarDuplicado(idLocal: string): Promise<RegistroResumido | null> {
  const registro = await prisma.registroAsistencia.findFirst({
    where: { OR: [{ entradaIdLocal: idLocal }, { salidaIdLocal: idLocal }] },
  });
  if (!registro) {
    return null;
  }
  const esEntrada = registro.entradaIdLocal === idLocal;
  const hora = (esEntrada ? registro.entradaEn : registro.salidaEn) ?? registro.creadoEn;
  return resumir(registro, esEntrada ? 'ENTRADA' : 'SALIDA', hora);
}

function resumir(
  registro: { id: string; trabajadorId: string; fecha: Date; tipoJornada: TipoJornada },
  tipo: TipoRegistro,
  hora: Date,
): RegistroResumido {
  return {
    id: registro.id,
    trabajadorId: registro.trabajadorId,
    fecha: formatearFecha(registro.fecha),
    tipo,
    hora: hora.toISOString(),
    tipoJornada: registro.tipoJornada,
  };
}
