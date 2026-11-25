/**
 * @archivo fabricas.ts
 * @proyecto Civil Trace
 * @descripcion Fábricas de datos de prueba (empresa, usuarios, obra) y ayudantes para construir la
 *   app y firmar tokens de acceso. Los datos siguen quickstart.md del feature 001.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos Constitución III (pruebas primero)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (módulo 00)
 */

// 1. Importaciones
import { randomBytes, randomUUID } from 'node:crypto';

import { construirApp } from '@/app';
import { prisma } from '@/baseDatos/clientePrisma';
import type { EstadoActividad, EstadoAvance, Rol, TipoAvance } from '@/generated/prisma/enums';
import { cifrarTexto } from '@/utilidades/cifrado';
import { calcularHashToken } from '@/utilidades/tokens';

// 2. Tipos e interfaces
type AppPrueba = Awaited<ReturnType<typeof construirApp>>;

interface DatosUsuarioPrueba {
  rol: Rol;
  empresaId: string;
  nombre?: string;
  correo?: string;
  oficio?: string | null;
  creadoEn?: Date;
}

interface DatosHorarioPrueba {
  obraId: string;
  empresaId: string;
  creadoPorId: string;
  horaEntrada?: string;
  horaSalida?: string;
  toleranciaMinutos?: number;
  diasLaborales?: number[];
  alcance?: 'GENERAL' | 'DIA';
  fecha?: string;
  creadoEn?: Date;
}

interface DatosObraPrueba {
  empresaId: string;
  supervisorId: string | null;
  trabajadorIds?: string[];
  nombre?: string;
  fechaInicio?: string;
  fechaFinal?: string;
}

interface DatosActividadPrueba {
  obraId: string;
  empresaId: string;
  responsableId?: string | null;
  nombre?: string;
  estado?: EstadoActividad;
  fechaEntrega?: string;
  fechaTerminada?: string | null;
}

interface DatosAvancePrueba {
  actividadId: string;
  empresaId: string;
  registradoPorId?: string | null;
  estado?: EstadoAvance;
  tipo?: TipoAvance;
  comentario?: string;
  fechaRegistro?: Date;
  fotoBlob?: string;
  // Feature 007: sin estos datos la foto queda como las anteriores al feature (sin ubicación).
  latitud?: number;
  longitud?: number;
  referenciaUbicacion?: string;
}

// 3. Constantes del módulo
// Hash argon2 fijo: las pruebas firman el token directamente y no necesitan la contraseña.
const HASH_CONTRASENA_PRUEBA = '$argon2id$v=19$m=65536,t=3,p=4$cHJ1ZWJh$cHJ1ZWJhcHJ1ZWJh';
const FECHA_INICIO_OBRA_POR_DEFECTO = '2026-01-01';
const FECHA_FINAL_OBRA_POR_DEFECTO = '2028-12-31';
// Alta fija de los usuarios: las faltas calculadas cuentan desde aquí (D-20), así las pruebas
// no dependen de la fecha real en que se ejecutan.
export const FECHA_ALTA_USUARIOS = new Date('2026-01-01T08:00:00Z');
export const LUNES_A_SABADO = [1, 2, 3, 4, 5, 6];

// 4. Funciones
/** Construye la app de Fastify lista para usar con app.inject(). */
export async function construirAppPrueba(): Promise<AppPrueba> {
  const app = await construirApp();
  await app.ready();
  return app;
}

/** Crea una empresa con códigos únicos. */
export async function crearEmpresa(nombre = 'Todo Concreto') {
  return prisma.empresa.create({
    data: {
      nombre,
      codigoTrabajadores: `T-${randomUUID()}`,
      codigoSupervisores: `S-${randomUUID()}`,
    },
  });
}

/** Crea un usuario del rol indicado dentro de la empresa. */
export async function crearUsuario(datos: DatosUsuarioPrueba) {
  return prisma.usuario.create({
    data: {
      nombre: datos.nombre ?? `Usuario ${datos.rol}`,
      correo: datos.correo ?? `${randomUUID()}@ejemplo.com`,
      contrasenaHash: HASH_CONTRASENA_PRUEBA,
      rol: datos.rol,
      empresaId: datos.empresaId,
      ...(datos.oficio !== undefined ? { oficio: datos.oficio } : {}),
      creadoEn: datos.creadoEn ?? FECHA_ALTA_USUARIOS,
    },
  });
}

/** Crea una obra con su supervisor y sus trabajadores asignados. */
export async function crearObra(datos: DatosObraPrueba) {
  return prisma.obra.create({
    data: {
      nombre: datos.nombre ?? 'Hospital',
      descripcion: 'Construcción del hospital general',
      direccion: 'Avenida Reforma',
      fechaInicio: new Date(datos.fechaInicio ?? FECHA_INICIO_OBRA_POR_DEFECTO),
      fechaFinal: new Date(datos.fechaFinal ?? FECHA_FINAL_OBRA_POR_DEFECTO),
      empresaId: datos.empresaId,
      supervisorId: datos.supervisorId,
      trabajadores: { connect: (datos.trabajadorIds ?? []).map((id) => ({ id })) },
    },
  });
}

/** Guarda un horario de obra (por defecto 08:00–16:00, 15 min, lunes a sábado, general). */
export async function crearHorario(datos: DatosHorarioPrueba) {
  return prisma.horarioObra.create({
    data: {
      obraId: datos.obraId,
      empresaId: datos.empresaId,
      creadoPorId: datos.creadoPorId,
      alcance: datos.alcance ?? 'GENERAL',
      fecha: datos.fecha ? new Date(`${datos.fecha}T00:00:00Z`) : null,
      horaEntrada: datos.horaEntrada ?? '08:00',
      horaSalida: datos.horaSalida ?? '16:00',
      toleranciaMinutos: datos.toleranciaMinutos ?? 15,
      diasLaborales: datos.diasLaborales ?? LUNES_A_SABADO,
      creadoEn: datos.creadoEn ?? FECHA_ALTA_USUARIOS,
    },
  });
}

/**
 * Firma un token de acceso para el usuario, como lo hace el inicio de sesión.
 *
 * @returns Encabezados listos para app.inject().
 */
export function iniciarSesion(
  app: AppPrueba,
  usuario: { id: string; rol: Rol; empresaId: string | null },
): { authorization: string } {
  const token = app.jwt.sign({
    sub: usuario.id,
    rol: usuario.rol,
    empresaId: usuario.empresaId ?? '',
  });
  return { authorization: `Bearer ${token}` };
}

/**
 * Crea el escenario base de quickstart.md: Todo Concreto con su dueño, la supervisora María
 * Castro, la trabajadora Ana Sánchez y la obra Hospital; además otra empresa con su trabajador
 * para las pruebas de aislamiento.
 */
export async function crearEscenarioBase() {
  const empresa = await crearEmpresa('Todo Concreto');
  const dueno = await crearUsuario({ rol: 'DUENO', empresaId: empresa.id, nombre: 'Dueño Prueba' });
  const maria = await crearUsuario({
    rol: 'SUPERVISOR',
    empresaId: empresa.id,
    nombre: 'María Castro',
    correo: 'maria.castro@ejemplo.com',
  });
  const ana = await crearUsuario({
    rol: 'TRABAJADOR',
    empresaId: empresa.id,
    nombre: 'Ana Sánchez',
    correo: 'ana.sanchez@ejemplo.com',
  });
  const obra = await crearObra({
    empresaId: empresa.id,
    supervisorId: maria.id,
    trabajadorIds: [ana.id],
  });

  const otraEmpresa = await crearEmpresa('Otra Constructora');
  const trabajadorAjeno = await crearUsuario({
    rol: 'TRABAJADOR',
    empresaId: otraEmpresa.id,
    nombre: 'Trabajador Ajeno',
  });

  return { empresa, dueno, maria, ana, obra, otraEmpresa, trabajadorAjeno };
}

export async function crearActividad(datos: DatosActividadPrueba) {
  return prisma.actividad.create({
    data: {
      nombre: datos.nombre ?? 'Colocar loseta',
      descripcion: 'Colocar loseta en el baño del segundo piso',
      fechaEntrega: new Date(`${datos.fechaEntrega ?? '2026-11-05'}T00:00:00Z`),
      fechaTerminada: datos.fechaTerminada ? new Date(`${datos.fechaTerminada}T00:00:00Z`) : null,
      estado: datos.estado ?? 'ACTIVA',
      obraId: datos.obraId,
      empresaId: datos.empresaId,
      responsableId: datos.responsableId ?? null,
    },
  });
}

export async function crearAvance(datos: DatosAvancePrueba) {
  return prisma.avanceActividad.create({
    data: {
      actividadId: datos.actividadId,
      empresaId: datos.empresaId,
      registradoPorId: datos.registradoPorId ?? null,
      estado: datos.estado ?? 'APROBADO',
      tipo: datos.tipo ?? 'DIARIO',
      comentario: datos.comentario ?? 'Avance del día',
      fechaRegistro: datos.fechaRegistro ?? new Date('2026-11-03T18:00:00Z'),
      fotoBlob: datos.fotoBlob ?? `${datos.empresaId}/avances/${randomUUID()}.jpg`,
      latitud: datos.latitud ?? null,
      longitud: datos.longitud ?? null,
      referenciaUbicacion: datos.referenciaUbicacion ?? null,
    },
  });
}

/**
 * Crea el enlace del portal de una obra directamente en la base (sin correo).
 *
 * @returns El token en texto, como lo recibiría el cliente.
 */
export async function crearEnlacePortal(
  obra: { id: string; empresaId: string },
  correo = 'cliente@ejemplo.com',
) {
  const token = randomBytes(32).toString('base64url');
  const llave = Buffer.from(process.env['CLAVE_CIFRADO_PORTAL'] ?? '', 'base64');
  await prisma.enlacePortal.create({
    data: {
      obraId: obra.id,
      empresaId: obra.empresaId,
      tokenHash: calcularHashToken(token),
      tokenCifrado: cifrarTexto(token, llave),
      correo,
    },
  });
  return token;
}
