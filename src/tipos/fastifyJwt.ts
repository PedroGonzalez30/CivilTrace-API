/**
 * @archivo fastifyJwt.ts
 * @proyecto Civil Trace
 * @descripcion Declara qué datos lleva el token de acceso para que TypeScript los conozca.
 * @autor Pedro Ivan Gonzalez Valdez
 * @fecha 16/11/2026
 * @version 1.0.0
 */

// 1. Importaciones
import '@fastify/jwt';

import type { Rol } from '@/generated/prisma/enums';

// 2. Tipos e interfaces
export interface DatosTokenAcceso {
  // Id del usuario (campo estándar "sub" del JWT).
  sub: string;
  rol: Rol;
  empresaId: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: DatosTokenAcceso;
    user: DatosTokenAcceso;
  }
}
