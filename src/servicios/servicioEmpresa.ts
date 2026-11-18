/**
 * @archivo servicioEmpresa.ts
 * @proyecto Civil Trace
 * @descripcion Lógica de consulta de los datos de la empresa del usuario.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { Rol } from '@/generated/prisma/browser';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface CodigosEmpresa {
  trabajadores: string;
  supervisores: string;
}

// 3. Constantes del módulo
const CODIGO_NO_ENCONTRADO = 404;
const MENSAJE_EMPRESA_NO_ENCONTRADA = 'Empresa no encontrada';

// 4. Funciones
/**
 * Devuelve los códigos de acceso de una empresa. El empresaId debe salir del token,
 * nunca de lo que mande el cliente.
 *
 * @param empresaId - Id de la empresa del usuario autenticado.
 * @returns Los códigos para unir trabajadores y supervisores.
 * @throws ErrorHttp 404 si la empresa ya no existe.
 */
export async function obtenerCodigosEmpresa(empresaId: string): Promise<CodigosEmpresa> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { codigoTrabajadores: true, codigoSupervisores: true },
  });
  if (!empresa) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, MENSAJE_EMPRESA_NO_ENCONTRADA);
  }
  return {
    trabajadores: empresa.codigoTrabajadores,
    supervisores: empresa.codigoSupervisores,
  };
}

export interface PersonaEmpresa {
  id: string;
  nombre: string;
}

export interface PersonalEmpresa {
  supervisores: PersonaEmpresa[];
  trabajadores: PersonaEmpresa[];
}

/**
 * Lista los supervisores y trabajadores de la empresa. Solo se leen id y nombre: nunca el
 * correo ni la contraseña.
 *
 * @param empresaId - Id de la empresa del usuario autenticado (sale del token).
 * @returns Supervisores y trabajadores, ordenados por nombre.
 */
export async function obtenerPersonalEmpresa(empresaId: string): Promise<PersonalEmpresa> {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId, rol: { in: [Rol.SUPERVISOR, Rol.TRABAJADOR] } },
    select: { id: true, nombre: true, rol: true },
    orderBy: { nombre: 'asc' },
  });

  const aPersona = ({ id, nombre }: { id: string; nombre: string }): PersonaEmpresa => ({
    id,
    nombre,
  });

  return {
    supervisores: usuarios.filter((usuario) => usuario.rol === Rol.SUPERVISOR).map(aPersona),
    trabajadores: usuarios.filter((usuario) => usuario.rol === Rol.TRABAJADOR).map(aPersona),
  };
}