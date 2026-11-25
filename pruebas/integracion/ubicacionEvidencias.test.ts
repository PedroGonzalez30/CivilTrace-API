/**
 * @archivo ubicacionEvidencias.test.ts
 * @proyecto Civil Trace
 * @descripcion Pruebas de la ubicación de cada evidencia (feature 007): coordenadas automáticas al
 *   subir la foto, referencia escrita cuando no hay señal GPS, y la ubicación en el detalle, el
 *   reporte y el portal del cliente.
 * @autor Emilio Manuel Esquivel
 * @fecha 25/11/2026
 * @version 1.0.0
 * @requerimientos RF-08 Capturar evidencia fotográfica, RF-12 Generar reporte de avance de obra,
 *   RF-66 Consultar avances en el portal del cliente
 * @historial 25/11/2026 - Emilio Manuel Esquivel - Creación (feature 007)
 */

// 1. Importaciones
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/baseDatos/clientePrisma';

import { limpiarTablas } from '../configuracion/baseDatosPrueba';
import { imagenesEnMemoria } from '../configuracion/dobleAlmacenamiento';
import {
  extraerTokenPortal,
  obtenerUltimoCorreo,
  restaurarCorreo,
} from '../configuracion/dobleCorreo';
import {
  construirAppPrueba,
  crearActividad,
  crearAvance,
  crearEnlacePortal,
  crearEscenarioBase,
  iniciarSesion,
} from '../configuracion/fabricas';

// 2. Tipos e interfaces
type Escenario = Awaited<ReturnType<typeof crearEscenarioBase>>;
type Usuario = Escenario['ana'];

interface FotoConUbicacion {
  id: string;
  ubicacion: { latitud: number; longitud: number; precisionMetros: number | null } | null;
  referenciaUbicacion: string | null;
}

// 3. Constantes del módulo
const FOTO = Buffer.from('foto-de-prueba');
const CORREO_CLIENTE = 'cliente.ubicacion@ejemplo.com';
const REFERENCIA = 'Sótano, junto a la cisterna';

// 4. Pruebas
describe('Ubicación de las evidencias (feature 007)', () => {
  let app: Awaited<ReturnType<typeof construirAppPrueba>>;
  let escenario: Escenario;
  let idActividad: string;

  const subir = (usuario: Usuario, cabeceras: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: `/obras/${escenario.obra.id}/actividades/${idActividad}/avances`,
      headers: { ...iniciarSesion(app, usuario), 'content-type': 'image/png', ...cabeceras },
      payload: FOTO,
    });

  beforeAll(async () => {
    await limpiarTablas();
    app = await construirAppPrueba();
    escenario = await crearEscenarioBase();
    await prisma.obra.update({
      where: { id: escenario.obra.id },
      data: { correoCliente: CORREO_CLIENTE },
    });
    idActividad = (
      await crearActividad({
        obraId: escenario.obra.id,
        empresaId: escenario.empresa.id,
        responsableId: escenario.ana.id,
      })
    ).id;
  });

  afterAll(async () => {
    restaurarCorreo();
    await app.close();
  });

  describe('CP12 Capturar evidencia con ubicación (RF-08)', () => {
    it('CP12-A14 guarda las coordenadas y la precisión que manda el teléfono', async () => {
      const respuesta = await subir(escenario.ana, {
        'x-latitud': '32.624538',
        'x-longitud': '-115.452261',
        'x-precision-ubicacion': '12.5',
      });

      expect(respuesta.statusCode).toBe(201);
      const avance = respuesta.json().avance as FotoConUbicacion;
      expect(avance.ubicacion).toEqual({
        latitud: 32.624538,
        longitud: -115.452261,
        precisionMetros: 12.5,
      });
      expect(avance.referenciaUbicacion).toBeNull();
    });

    it('CP12-A15 sin señal GPS guarda la referencia escrita y no inventa coordenadas', async () => {
      const respuesta = await subir(escenario.maria, {
        'x-referencia-ubicacion': encodeURIComponent(REFERENCIA),
      });

      expect(respuesta.statusCode).toBe(201);
      const avance = respuesta.json().avance as FotoConUbicacion;
      expect(avance.ubicacion).toBeNull();
      expect(avance.referenciaUbicacion).toBe(REFERENCIA);
    });

    it('CP12-A16 sin coordenadas ni referencia no registra la evidencia', async () => {
      const antes = await prisma.avanceActividad.count();
      const respuesta = await subir(escenario.ana, { 'x-referencia-ubicacion': '%20%20' });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json().mensaje).toContain('referencia');
      expect(await prisma.avanceActividad.count()).toBe(antes);
    });

    it('CP12-A17 rechaza coordenadas fuera de rango o incompletas', async () => {
      const fueraDeRango = await subir(escenario.ana, { 'x-latitud': '91', 'x-longitud': '10' });
      const soloLatitud = await subir(escenario.ana, { 'x-latitud': '32.6' });
      const noNumerica = await subir(escenario.ana, { 'x-latitud': 'abc', 'x-longitud': '10' });

      expect(fueraDeRango.statusCode).toBe(400);
      expect(soloLatitud.statusCode).toBe(400);
      expect(noNumerica.statusCode).toBe(400);
    });

    it('CP12-A18 con coordenadas la referencia sobra y no se guarda', async () => {
      const respuesta = await subir(escenario.maria, {
        'x-latitud': '32.6',
        'x-longitud': '-115.4',
        'x-referencia-ubicacion': encodeURIComponent('Otra cosa'),
      });

      expect(respuesta.statusCode).toBe(201);
      expect(respuesta.json().avance.referenciaUbicacion).toBeNull();
    });

    it('CP11-A14 el detalle de la actividad muestra la ubicación de cada foto', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/actividades/${idActividad}`,
        headers: iniciarSesion(app, escenario.maria),
      });

      const avances = respuesta.json().actividad.avances as FotoConUbicacion[];
      expect(avances.some((avance) => avance.ubicacion?.latitud === 32.624538)).toBe(true);
      expect(avances.some((avance) => avance.referenciaUbicacion === REFERENCIA)).toBe(true);
    });
  });

  describe('CP15 y CP16 Ubicación en el reporte y el portal (RF-12, RF-66)', () => {
    let idConGps: string;
    let idSinGps: string;
    let idAnterior: string;

    beforeAll(async () => {
      const base = { actividadId: idActividad, empresaId: escenario.empresa.id };
      const conGps = await crearAvance({
        ...base,
        latitud: 19.432608,
        longitud: -99.133209,
        fechaRegistro: new Date('2026-11-10T18:00:00Z'),
      });
      const sinGps = await crearAvance({
        ...base,
        referenciaUbicacion: REFERENCIA,
        fechaRegistro: new Date('2026-11-10T19:00:00Z'),
      });
      // Foto de antes del feature 007: no tiene ubicación ni referencia.
      const anterior = await crearAvance({
        ...base,
        fechaRegistro: new Date('2026-11-10T20:00:00Z'),
      });
      for (const avance of [conGps, sinGps, anterior]) {
        imagenesEnMemoria.set(avance.fotoBlob, { datos: FOTO, tipo: 'image/jpeg' });
      }
      idConGps = conGps.id;
      idSinGps = sinGps.id;
      idAnterior = anterior.id;
    });

    const buscar = (fotos: FotoConUbicacion[], id: string) => fotos.find((foto) => foto.id === id);

    it('CP15-A11 el reporte de avance trae la ubicación de cada foto aprobada', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/reporte?fechaInicio=2026-11-10&fechaFin=2026-11-10`,
        headers: iniciarSesion(app, escenario.maria),
      });

      const fotos = respuesta
        .json()
        .actividades.flatMap((actividad: { avances: FotoConUbicacion[] }) => actividad.avances);
      expect(buscar(fotos, idConGps)?.ubicacion).toMatchObject({ latitud: 19.432608 });
      expect(buscar(fotos, idSinGps)).toMatchObject({
        ubicacion: null,
        referenciaUbicacion: REFERENCIA,
      });
      expect(buscar(fotos, idAnterior)).toMatchObject({
        ubicacion: null,
        referenciaUbicacion: null,
      });
    });

    it('CP16-PORTAL-E7 el portal muestra la ubicación en avances y en el detalle de la entrega', async () => {
      let token = await crearEnlacePortal(escenario.obra, CORREO_CLIENTE);
      const avances = await app.inject({
        method: 'GET',
        url: '/portal/avances',
        headers: { 'x-token-portal': token },
      });
      const fotosAvances = avances
        .json()
        .flatMap((actividad: { fotos: FotoConUbicacion[] }) => actividad.fotos);
      expect(buscar(fotosAvances, idConGps)?.ubicacion).toMatchObject({ longitud: -99.133209 });
      expect(buscar(fotosAvances, idSinGps)?.referenciaUbicacion).toBe(REFERENCIA);

      const envio = await app.inject({
        method: 'POST',
        url: `/obras/${escenario.obra.id}/entregas`,
        headers: iniciarSesion(app, escenario.maria),
        payload: { fechaInicio: '2026-11-10', fechaFin: '2026-11-10' },
      });
      expect(envio.statusCode).toBe(201);
      token = extraerTokenPortal(obtenerUltimoCorreo(CORREO_CLIENTE)) ?? token;

      const detalle = await app.inject({
        method: 'GET',
        url: `/portal/entregas/${envio.json().id}`,
        headers: { 'x-token-portal': token },
      });
      const fotosEntrega = detalle
        .json()
        .actividades.flatMap((actividad: { fotos: FotoConUbicacion[] }) => actividad.fotos);
      expect(buscar(fotosEntrega, idConGps)?.ubicacion).toMatchObject({ latitud: 19.432608 });
      expect(buscar(fotosEntrega, idSinGps)?.referenciaUbicacion).toBe(REFERENCIA);
    });

    it('CP15-A12 el reporte PDF de la entrega se genera con fotos con y sin ubicación', async () => {
      const lista = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/entregas`,
        headers: iniciarSesion(app, escenario.maria),
      });
      const idEntrega = lista.json()[0].id as string;
      const pdf = await app.inject({
        method: 'GET',
        url: `/obras/${escenario.obra.id}/entregas/${idEntrega}/reporte.pdf`,
        headers: iniciarSesion(app, escenario.maria),
      });

      expect(pdf.statusCode).toBe(200);
      expect(pdf.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    });
  });
});
