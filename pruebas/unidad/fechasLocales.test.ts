/**
 * @archivo fechasLocales.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de las conversiones entre instantes y fecha/hora local por zona horaria.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-58 Mostrar calendario de asistencia, RF-60 Registrar retardo o salida
 *   anticipada
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { describe, expect, it } from 'vitest';

import {
  construirInstante,
  convertirHoraAMinutos,
  esZonaHorariaValida,
  obtenerDiaSemana,
  obtenerDiasDelMes,
  obtenerFechaLocal,
  obtenerMinutosLocales,
  sumarDias,
} from '@/utilidades/fechasLocales';

// 3. Constantes del módulo
const TIJUANA = 'America/Tijuana';
const CDMX = 'America/Mexico_City';

// 4. Pruebas
describe('fechasLocales', () => {
  it('CP21-A5 convierte un instante a fecha y minutos locales en Tijuana con horario de verano', () => {
    const instante = new Date('2026-05-19T15:02:00Z');

    expect(obtenerFechaLocal(instante, TIJUANA)).toBe('2026-05-19');
    expect(obtenerMinutosLocales(instante, TIJUANA)).toBe(8 * 60 + 2);
  });

  it('CP21-A6 convierte un instante en Tijuana en horario normal (invierno)', () => {
    const instante = new Date('2026-11-20T16:02:00Z');

    expect(obtenerMinutosLocales(instante, TIJUANA)).toBe(8 * 60 + 2);
  });

  it('CP21-A7 la fecha local puede ser el día anterior a la fecha UTC', () => {
    expect(obtenerFechaLocal(new Date('2026-11-20T07:30:00Z'), TIJUANA)).toBe('2026-11-19');
  });

  it('CP21-A8 la misma hora cambia de zona sin tocar el instante (D-15)', () => {
    const instante = new Date('2026-11-20T14:02:00Z');

    expect(obtenerMinutosLocales(instante, CDMX)).toBe(8 * 60 + 2);
  });

  it('CP21-A9 construye el instante de una hora local', () => {
    expect(construirInstante('2026-05-19', '08:00', TIJUANA).toISOString()).toBe(
      '2026-05-19T15:00:00.000Z',
    );
    expect(construirInstante('2026-11-20', '08:00', TIJUANA).toISOString()).toBe(
      '2026-11-20T16:00:00.000Z',
    );
    expect(construirInstante('2026-11-20', '08:00', CDMX).toISOString()).toBe(
      '2026-11-20T14:00:00.000Z',
    );
  });

  it('CP22-A1 convierte HH:MM a minutos y obtiene el día de la semana', () => {
    expect(convertirHoraAMinutos('08:15')).toBe(495);
    expect(convertirHoraAMinutos('00:00')).toBe(0);
    expect(obtenerDiaSemana('2026-05-19')).toBe(2);
    expect(obtenerDiaSemana('2026-05-17')).toBe(0);
  });

  it('CP22-A2 valida zonas horarias IANA', () => {
    expect(esZonaHorariaValida(TIJUANA)).toBe(true);
    expect(esZonaHorariaValida(CDMX)).toBe(true);
    expect(esZonaHorariaValida('Marte/Base')).toBe(false);
  });

  it('CP19-A5 suma días y lista los días de un mes', () => {
    expect(sumarDias('2026-02-28', 1)).toBe('2026-03-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    const dias = obtenerDiasDelMes('2026-05');
    expect(dias).toHaveLength(31);
    expect(dias[0]).toBe('2026-05-01');
    expect(dias[30]).toBe('2026-05-31');
  });
});
