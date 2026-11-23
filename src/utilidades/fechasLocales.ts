/**
 * @archivo fechasLocales.ts
 * @proyecto Civil Trace
 * @descripcion Conversión entre instantes (UTC) y fecha/hora local de una zona IANA. La usan el
 *   horario de obra, el registro de asistencia y el calendario. Usa Intl de Node: sin dependencias.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-58 Mostrar calendario de asistencia, RF-60 Registrar retardo o salida
 *   anticipada
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001, research R-05)
 */

// 2. Tipos e interfaces
interface PartesLocales {
  anio: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

// 3. Constantes del módulo
const MINUTOS_POR_HORA = 60;
const MILISEGUNDOS_POR_MINUTO = 60_000;
const LARGO_FECHA_ISO = 10;
const formateadores = new Map<string, Intl.DateTimeFormat>();

// 4. Funciones privadas
// Crear un Intl.DateTimeFormat es costoso; se reutiliza uno por zona.
function obtenerFormateador(zona: string): Intl.DateTimeFormat {
  let formateador = formateadores.get(zona);
  if (!formateador) {
    formateador = new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formateadores.set(zona, formateador);
  }
  return formateador;
}

function obtenerPartesLocales(instante: Date, zona: string): PartesLocales {
  const partes = Object.fromEntries(
    obtenerFormateador(zona)
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  );
  return {
    anio: Number(partes['year']),
    mes: Number(partes['month']),
    dia: Number(partes['day']),
    hora: Number(partes['hour']),
    minuto: Number(partes['minute']),
  };
}

function rellenar(numero: number): string {
  return String(numero).padStart(2, '0');
}

// 5. Funciones públicas
/**
 * Fecha local (YYYY-MM-DD) de un instante en la zona indicada.
 *
 * @param instante - Momento a convertir.
 * @param zona - Zona IANA, por ejemplo America/Tijuana.
 * @returns La fecha local.
 */
export function obtenerFechaLocal(instante: Date, zona: string): string {
  const { anio, mes, dia } = obtenerPartesLocales(instante, zona);
  return `${anio}-${rellenar(mes)}-${rellenar(dia)}`;
}

/**
 * Minutos desde la medianoche local de un instante.
 *
 * @param instante - Momento a convertir.
 * @param zona - Zona IANA.
 * @returns Minutos de 0 a 1439.
 */
export function obtenerMinutosLocales(instante: Date, zona: string): number {
  const { hora, minuto } = obtenerPartesLocales(instante, zona);
  return hora * MINUTOS_POR_HORA + minuto;
}

/**
 * Convierte una hora "HH:MM" (24 h) a minutos desde la medianoche.
 *
 * @param hora - Hora en formato HH:MM.
 * @returns Minutos de 0 a 1439.
 */
export function convertirHoraAMinutos(hora: string): number {
  const [horas = 0, minutos = 0] = hora.split(':').map(Number);
  return horas * MINUTOS_POR_HORA + minutos;
}

/**
 * Día de la semana de una fecha YYYY-MM-DD (0 = domingo … 6 = sábado).
 *
 * @param fecha - Fecha local.
 * @returns El día de la semana.
 */
export function obtenerDiaSemana(fecha: string): number {
  return convertirFechaADate(fecha).getUTCDay();
}

/**
 * Instante (UTC) que corresponde a una fecha y hora local en la zona indicada.
 *
 * @param fecha - Fecha local YYYY-MM-DD.
 * @param hora - Hora local HH:MM.
 * @param zona - Zona IANA.
 * @returns El instante.
 */
export function construirInstante(fecha: string, hora: string, zona: string): Date {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const [horas = 0, minutos = 0] = hora.split(':').map(Number);
  const comoSiFueraUtc = Date.UTC(anio, mes - 1, dia, horas, minutos);

  // Se corrige dos veces porque el desfase puede cambiar justo en el cambio de horario.
  let instante = comoSiFueraUtc;
  for (let intento = 0; intento < 2; intento += 1) {
    const partes = obtenerPartesLocales(new Date(instante), zona);
    const localComoUtc = Date.UTC(
      partes.anio,
      partes.mes - 1,
      partes.dia,
      partes.hora,
      partes.minuto,
    );
    instante += comoSiFueraUtc - localComoUtc;
  }
  return new Date(instante);
}

/**
 * Indica si el texto es una zona horaria IANA que Node reconoce.
 *
 * @param zona - Texto a validar.
 * @returns true si es válida.
 */
export function esZonaHorariaValida(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/**
 * Convierte una fecha YYYY-MM-DD al Date que Prisma guarda en columnas @db.Date.
 *
 * @param fecha - Fecha local.
 * @returns Date a la medianoche UTC de esa fecha.
 */
export function convertirFechaADate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

/**
 * Convierte un Date de una columna @db.Date a YYYY-MM-DD.
 *
 * @param fecha - Date leído de Prisma.
 * @returns La fecha en texto.
 */
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, LARGO_FECHA_ISO);
}

/**
 * Suma (o resta) días a una fecha YYYY-MM-DD.
 *
 * @param fecha - Fecha de partida.
 * @param dias - Días a sumar; negativo para restar.
 * @returns La nueva fecha.
 */
export function sumarDias(fecha: string, dias: number): string {
  const base = convertirFechaADate(fecha);
  base.setUTCDate(base.getUTCDate() + dias);
  return formatearFecha(base);
}

/**
 * Lista todas las fechas de un mes.
 *
 * @param mes - Mes en formato YYYY-MM.
 * @returns Las fechas YYYY-MM-DD del mes, en orden.
 */
export function obtenerDiasDelMes(mes: string): string[] {
  const dias: string[] = [];
  let fecha = `${mes}-01`;
  while (fecha.startsWith(mes)) {
    dias.push(fecha);
    fecha = sumarDias(fecha, 1);
  }
  return dias;
}

/**
 * Diferencia en minutos entre dos instantes (b - a).
 *
 * @param a - Instante inicial.
 * @param b - Instante final.
 * @returns Minutos, con decimales.
 */
export function restarInstantesEnMinutos(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MILISEGUNDOS_POR_MINUTO;
}
