/**
 * @archivo clasificacionAsistencia.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de la clasificación automática de la jornada (retardo y salida temprana),
 *   incluidos los límites exactos de la tolerancia (SC-006).
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-60 Registrar retardo o salida anticipada
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { describe, expect, it } from 'vitest';

import { clasificarJornada } from '@/servicios/servicioRegistroAsistencia';

// 3. Constantes del módulo
const HORARIO = {
  horaEntrada: '08:00',
  horaSalida: '16:00',
  toleranciaMinutos: 15,
  esDiaLaborable: true,
};
const minutos = (hora: number, minuto: number) => hora * 60 + minuto;

// 4. Pruebas
describe('clasificarJornada', () => {
  it('CP19-A4 en el límite exacto de la tolerancia es completa; un minuto después, retardo', () => {
    expect(clasificarJornada({ entradaMinutos: minutos(8, 15), horario: HORARIO })).toBe(
      'COMPLETA',
    );
    expect(clasificarJornada({ entradaMinutos: minutos(8, 16), horario: HORARIO })).toBe('RETARDO');
    expect(clasificarJornada({ entradaMinutos: minutos(7, 50), horario: HORARIO })).toBe(
      'COMPLETA',
    );
  });

  it('CP21-A13 una salida antes de la hora de salida marca salida temprana', () => {
    expect(
      clasificarJornada({
        entradaMinutos: minutos(8, 0),
        salidaMinutos: minutos(15, 30),
        horario: HORARIO,
        tipoActual: 'COMPLETA',
      }),
    ).toBe('SALIDA_TEMPRANA');
    expect(
      clasificarJornada({
        entradaMinutos: minutos(8, 0),
        salidaMinutos: minutos(16, 0),
        horario: HORARIO,
        tipoActual: 'COMPLETA',
      }),
    ).toBe('COMPLETA');
  });

  it('CP21-A14 un retardo sigue siendo retardo aunque salga temprano', () => {
    expect(
      clasificarJornada({
        entradaMinutos: minutos(8, 30),
        salidaMinutos: minutos(15, 0),
        horario: HORARIO,
        tipoActual: 'RETARDO',
      }),
    ).toBe('RETARDO');
  });

  it('CP19-A12 una entrada desde la hora de salida es falta, no retardo (D-22)', () => {
    expect(clasificarJornada({ entradaMinutos: minutos(15, 59), horario: HORARIO })).toBe(
      'RETARDO',
    );
    expect(clasificarJornada({ entradaMinutos: minutos(16, 0), horario: HORARIO })).toBe('FALTA');
    expect(clasificarJornada({ entradaMinutos: minutos(20, 0), horario: HORARIO })).toBe('FALTA');
  });

  it('CP19-A13 una falta sigue siendo falta al registrar la salida (D-22)', () => {
    expect(
      clasificarJornada({
        entradaMinutos: minutos(20, 0),
        salidaMinutos: minutos(21, 0),
        horario: HORARIO,
        tipoActual: 'FALTA',
      }),
    ).toBe('FALTA');
  });

  it('CP21-A15 sin horario o en día no laborable no se clasifica', () => {
    expect(clasificarJornada({ entradaMinutos: minutos(10, 0), horario: null })).toBe('COMPLETA');
    expect(
      clasificarJornada({
        entradaMinutos: minutos(10, 0),
        horario: { ...HORARIO, esDiaLaborable: false },
      }),
    ).toBe('COMPLETA');
  });
});
