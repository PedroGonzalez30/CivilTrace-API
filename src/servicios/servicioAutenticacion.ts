/**
 * @archivo servicioAutenticacion.ts
 * @proyecto Civil Trace
 * @descripcion Lógica de registro, inicio de sesión, refresco y cierre de sesión.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { randomBytes, randomUUID } from 'node:crypto';

import * as argon2 from 'argon2';

import { prisma } from '@/baseDatos/clientePrisma';
import { DURACION_TOKEN_REFRESCO_MS } from '@/constantes/autenticacion';
import type { DatosLogin, DatosRegistro } from '@/esquemas/esquemasAutenticacion';
import { Prisma } from '@/generated/prisma/client';
import { Rol } from '@/generated/prisma/enums';
import { generarCodigoAcceso } from '@/utilidades/codigosAcceso';
import { ErrorHttp } from '@/utilidades/errores';
import { calcularHashToken, generarTokenRefresco } from '@/utilidades/tokens';

// 2. Tipos e interfaces
export interface UsuarioPublico {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string;
  empresa: string;
}

export interface ResultadoSesion {
  usuario: UsuarioPublico;
  tokenRefresco: string;
}

interface FilaUsuario {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  empresaId: string;
  empresa: { nombre: string };
}

// 3. Constantes del módulo
const CODIGO_NO_AUTORIZADO = 401;
const CODIGO_CONFLICTO = 409;
const CODIGO_PETICION_INVALIDA = 400;
const CODIGO_PRISMA_VIOLACION_UNICA = 'P2002';
const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos';
const MENSAJE_SESION = 'Sesión no válida o expirada';
const MENSAJE_CORREO_REGISTRADO = 'Este correo ya está registrado';
const MENSAJE_CODIGO_INVALIDO = 'Código de empresa inválido';
const SELECCION_EMPRESA = { select: { nombre: true } } as const;

// Hash de relleno: si el correo no existe se verifica contra este, para que la respuesta tarde
// lo mismo y no se pueda descubrir qué correos están registrados midiendo el tiempo.
const HASH_RELLENO = await argon2.hash(randomBytes(16).toString('hex'));

// 4. Funciones privadas
function aUsuarioPublico(fila: FilaUsuario): UsuarioPublico {
  return {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    empresaId: fila.empresaId,
    empresa: fila.empresa.nombre,
  };
}

async function crearTokenRefresco(usuarioId: string, familiaId: string): Promise<string> {
  const token = generarTokenRefresco();
  await prisma.tokenRefresco.create({
    data: {
      tokenHash: calcularHashToken(token),
      familiaId,
      usuarioId,
      venceEn: new Date(Date.now() + DURACION_TOKEN_REFRESCO_MS),
    },
  });
  return token;
}

async function revocarFamilia(familiaId: string): Promise<void> {
  await prisma.tokenRefresco.updateMany({
    where: { familiaId, revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}

function esCorreoDuplicado(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === CODIGO_PRISMA_VIOLACION_UNICA
  );
}

async function crearUsuarioYEmpresa(
  datos: DatosRegistro,
  contrasenaHash: string,
): Promise<FilaUsuario> {
  const datosUsuario = {
    nombre: datos.nombre,
    correo: datos.correo,
    contrasenaHash,
    rol: datos.rol,
  };

  if (datos.rol === Rol.DUENO) {
    // Un create anidado se ejecuta en UNA transacción: o se crea todo o no se crea nada.
    const empresa = await prisma.empresa.create({
      data: {
        nombre: datos.empresa,
        codigoTrabajadores: generarCodigoAcceso(),
        codigoSupervisores: generarCodigoAcceso(),
        usuarios: { create: datosUsuario },
      },
      include: { usuarios: true },
    });
    const dueno = empresa.usuarios[0];
    if (!dueno) {
      throw new Error('No se creó el usuario dueño');
    }
    return { ...dueno, empresa: { nombre: empresa.nombre } };
  }

  const codigo = datos.empresa.toUpperCase();
  const empresa = await prisma.empresa.findUnique({
    where:
      datos.rol === Rol.SUPERVISOR ? { codigoSupervisores: codigo } : { codigoTrabajadores: codigo },
    select: { id: true, nombre: true },
  });
  if (!empresa) {
    throw new ErrorHttp(CODIGO_PETICION_INVALIDA, MENSAJE_CODIGO_INVALIDO);
  }

  const usuario = await prisma.usuario.create({
    data: { ...datosUsuario, empresaId: empresa.id },
  });
  return { ...usuario, empresa: { nombre: empresa.nombre } };
}

// 5. Funciones públicas
/**
 * Registra a un usuario. El dueño crea su empresa y sus códigos; supervisor y trabajador se
 * unen a una empresa con su código.
 *
 * @param datos - Datos ya validados del registro.
 * @returns El usuario creado y su primer token de refresco.
 * @throws ErrorHttp 409 si el correo ya existe; 400 si el código de empresa no es válido.
 */
export async function registrarUsuario(datos: DatosRegistro): Promise<ResultadoSesion> {
  const existente = await prisma.usuario.findUnique({
    where: { correo: datos.correo },
    select: { id: true },
  });
  if (existente) {
    throw new ErrorHttp(CODIGO_CONFLICTO, MENSAJE_CORREO_REGISTRADO);
  }

  const contrasenaHash = await argon2.hash(datos.contrasena);

  try {
    const fila = await crearUsuarioYEmpresa(datos, contrasenaHash);
    const tokenRefresco = await crearTokenRefresco(fila.id, randomUUID());
    return { usuario: aUsuarioPublico(fila), tokenRefresco };
  } catch (error) {
    // Dos registros simultáneos con el mismo correo: la base de datos rechaza el segundo.
    if (esCorreoDuplicado(error)) {
      throw new ErrorHttp(CODIGO_CONFLICTO, MENSAJE_CORREO_REGISTRADO);
    }
    throw error;
  }
}

/**
 * Inicia sesión con correo y contraseña. El mensaje de error es el mismo si falla el correo o
 * la contraseña.
 *
 * @param datos - Correo (normalizado) y contraseña.
 * @returns El usuario y un token de refresco nuevo.
 * @throws ErrorHttp 401 si las credenciales no son correctas.
 */
export async function iniciarSesion(datos: DatosLogin): Promise<ResultadoSesion> {
  const fila = await prisma.usuario.findUnique({
    where: { correo: datos.correo },
    include: { empresa: SELECCION_EMPRESA },
  });

  const hashAVerificar = fila?.contrasenaHash ?? HASH_RELLENO;
  const esCorrecta = await argon2.verify(hashAVerificar, datos.contrasena);

  if (!fila || !esCorrecta) {
    throw new ErrorHttp(CODIGO_NO_AUTORIZADO, MENSAJE_CREDENCIALES);
  }

  const tokenRefresco = await crearTokenRefresco(fila.id, randomUUID());
  return { usuario: aUsuarioPublico(fila), tokenRefresco };
}

/**
 * Cambia un token de refresco por uno nuevo (rotación). Cada token sirve una sola vez; si se
 * presenta uno ya usado, se asume robo y se revoca toda la sesión (la familia).
 *
 * @param tokenPlano - Token de refresco que mandó la app.
 * @returns El usuario y el token de refresco nuevo.
 * @throws ErrorHttp 401 si el token no existe, venció, se revocó o ya se había usado.
 */
export async function refrescarSesion(tokenPlano: string): Promise<ResultadoSesion> {
  const registro = await prisma.tokenRefresco.findUnique({
    where: { tokenHash: calcularHashToken(tokenPlano) },
    include: { usuario: { include: { empresa: SELECCION_EMPRESA } } },
  });
  const sesionInvalida = new ErrorHttp(CODIGO_NO_AUTORIZADO, MENSAJE_SESION);

  if (!registro) {
    throw sesionInvalida;
  }
  if (registro.revocadoEn !== null) {
    await revocarFamilia(registro.familiaId);
    throw sesionInvalida;
  }
  if (registro.venceEn <= new Date()) {
    throw sesionInvalida;
  }

  const tokenNuevo = await prisma.$transaction(async (transaccion) => {
    // Reclamo atómico: solo una petición puede marcar este token como usado.
    const reclamo = await transaccion.tokenRefresco.updateMany({
      where: { id: registro.id, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    if (reclamo.count === 0) {
      return null;
    }

    const token = generarTokenRefresco();
    await transaccion.tokenRefresco.create({
      data: {
        tokenHash: calcularHashToken(token),
        familiaId: registro.familiaId,
        usuarioId: registro.usuarioId,
        venceEn: new Date(Date.now() + DURACION_TOKEN_REFRESCO_MS),
      },
    });
    return token;
  });

  if (tokenNuevo === null) {
    await revocarFamilia(registro.familiaId);
    throw sesionInvalida;
  }

  return { usuario: aUsuarioPublico(registro.usuario), tokenRefresco: tokenNuevo };
}

/**
 * Cierra la sesión revocando todos los tokens de su familia. Si el token no existe no hace
 * nada: cerrar sesión siempre "funciona".
 *
 * @param tokenPlano - Token de refresco de la sesión que se cierra.
 */
export async function cerrarSesion(tokenPlano: string): Promise<void> {
  const registro = await prisma.tokenRefresco.findUnique({
    where: { tokenHash: calcularHashToken(tokenPlano) },
    select: { familiaId: true },
  });
  if (registro) {
    await revocarFamilia(registro.familiaId);
  }
}

/**
 * Obtiene los datos públicos del usuario a partir del id guardado en el token de acceso.
 *
 * @param usuarioId - Id del usuario.
 * @returns El usuario.
 * @throws ErrorHttp 401 si el usuario ya no existe.
 */
export async function obtenerUsuarioActual(usuarioId: string): Promise<UsuarioPublico> {
  const fila = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { empresa: SELECCION_EMPRESA },
  });
  if (!fila) {
    throw new ErrorHttp(CODIGO_NO_AUTORIZADO, MENSAJE_SESION);
  }
  return aUsuarioPublico(fila);
}
