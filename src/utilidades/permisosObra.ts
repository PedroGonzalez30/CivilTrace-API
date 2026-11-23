/**
 * @archivo permisosObra.ts
 * @proyecto Civil Trace
 * @descripcion Comprobaciones de pertenencia y rol sobre una obra. Las usan asistencia y horario;
 *   sirven también para los features de desempeño y reportes.
 * @autor Emilio Manuel Esquivel
 * @fecha 23/11/2026
 * @version 1.0.0
 * @requerimientos RF-27 Registrar asistencia por el supervisor, RF-58 Mostrar calendario de
 *   asistencia (aislamiento por empresa, constitución IV.2)
 * @historial 23/11/2026 - Emilio Manuel Esquivel - Creación (feature 001)
 */

// 1. Importaciones
import { prisma } from '@/baseDatos/clientePrisma';
import { Rol } from '@/generated/prisma/enums';
import type { DatosTokenAcceso } from '@/tipos/fastifyJwt';
import { ErrorHttp } from '@/utilidades/errores';

// 2. Tipos e interfaces
export interface ObraBasica {
  id: string;
  nombre: string;
  empresaId: string;
  supervisorId: string | null;
  fechaInicio: Date;
}

// 3. Constantes del módulo
const CODIGO_PROHIBIDO = 403;
const CODIGO_NO_ENCONTRADO = 404;
const MENSAJE_SIN_PERMISO = 'No tienes permiso para realizar esta acción';

// 4. Funciones
/**
 * Busca una obra dentro de la empresa del usuario. Una obra de otra empresa se trata como
 * inexistente para no revelar que existe.
 *
 * @param obraId - Obra buscada.
 * @param empresaId - Empresa del token.
 * @returns Los datos básicos de la obra.
 * @throws ErrorHttp 404 si no existe en la empresa.
 */
export async function obtenerObraDeEmpresa(obraId: string, empresaId: string): Promise<ObraBasica> {
  const obra = await prisma.obra.findFirst({
    where: { id: obraId, empresaId },
    select: { id: true, nombre: true, empresaId: true, supervisorId: true, fechaInicio: true },
  });
  if (!obra) {
    throw new ErrorHttp(CODIGO_NO_ENCONTRADO, 'La obra no existe');
  }
  return obra;
}

/** Indica si el usuario es el supervisor de la obra. */
export function esSupervisorDeObra(obra: ObraBasica, usuario: DatosTokenAcceso): boolean {
  return usuario.rol === Rol.SUPERVISOR && obra.supervisorId === usuario.sub;
}

/**
 * Exige que el usuario sea el supervisor de la obra.
 *
 * @throws ErrorHttp 403 si no lo es.
 */
export function exigirSupervisorDeObra(obra: ObraBasica, usuario: DatosTokenAcceso): void {
  if (!esSupervisorDeObra(obra, usuario)) {
    throw new ErrorHttp(CODIGO_PROHIBIDO, MENSAJE_SIN_PERMISO);
  }
}

/**
 * Exige que el usuario sea el supervisor de la obra o el dueño de la empresa.
 *
 * @throws ErrorHttp 403 si no es ninguno.
 */
export function exigirSupervisorODueno(obra: ObraBasica, usuario: DatosTokenAcceso): void {
  const esDueno = usuario.rol === Rol.DUENO && obra.empresaId === usuario.empresaId;
  if (!esDueno && !esSupervisorDeObra(obra, usuario)) {
    throw new ErrorHttp(CODIGO_PROHIBIDO, MENSAJE_SIN_PERMISO);
  }
}

/**
 * Indica si el trabajador está asignado a la obra.
 *
 * @param trabajadorId - Trabajador.
 * @param obraId - Obra.
 * @returns true si está asignado.
 */
export async function estaAsignadoAObra(trabajadorId: string, obraId: string): Promise<boolean> {
  const coincidencias = await prisma.obra.count({
    where: { id: obraId, trabajadores: { some: { id: trabajadorId } } },
  });
  return coincidencias > 0;
}

/**
 * Exige que el usuario pueda consultar la obra: su supervisor, el dueño o un trabajador
 * asignado.
 *
 * @throws ErrorHttp 403 si no tiene relación con la obra.
 */
export async function exigirAccesoAObra(
  obra: ObraBasica,
  usuario: DatosTokenAcceso,
): Promise<void> {
  if (usuario.rol === Rol.TRABAJADOR) {
    if (!(await estaAsignadoAObra(usuario.sub, obra.id))) {
      throw new ErrorHttp(CODIGO_PROHIBIDO, MENSAJE_SIN_PERMISO);
    }
    return;
  }
  exigirSupervisorODueno(obra, usuario);
}
