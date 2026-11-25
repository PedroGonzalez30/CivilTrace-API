# Constitución del proyecto Civil Trace

Equipo 2+2 (UABC FIAD, grupo 972). Estos principios son obligatorios para toda especificación,
plan, tarea y línea de código. Si una instrucción posterior los contradice, se detiene el trabajo y
se pregunta al equipo.

## Core Principles

### I. Alcance: el Figma manda

1. Se desarrolla el **MVP que muestran las pantallas del Figma** `EIXrnioyKFd9EoBY5PINOV` (páginas
   "Page 1", "Page 2", "Dueño" y la sección "Pantallas nuevas — propuesta (20/11/2026)").
2. Lo que no está en el Figma **no se desarrolla**. Si una función hace falta para que el sistema
   funcione, se propone al equipo con su justificación y, si se aprueba, se diseña con el mismo
   estilo.
3. El SRS (ISO/IEC/IEEE 29148) da los requerimientos y criterios de aceptación. Desde el feature 004 rige el **SRS v5.0** (`SRS_Civil_Trace_v5.0_con_cambios.docx`, D-28); los features 001 a 003 conservan la numeración de la V4.0. Cuando el SRS
   y el Figma no coinciden, manda el Figma y se registra el ajuste en `docs/decisiones.md`.
4. Cada artefacto (spec, plan, tarea, archivo) DEBE citar los requerimientos que atiende con su
   clave del **SRS vigente** (v5.0 desde el feature 004; por ejemplo `RF-55 Aprobar avances de trabajadores`).

**Razón:** evita trabajo fuera del alcance acordado y mantiene la trazabilidad con el SRS.

### II. Estándar de codificación (ECCT v1.0) — no negociable

- TypeScript estricto. Prohibido `any`; si el tipo es desconocido se usa `unknown` y se valida.
  `const` por defecto, `let` solo si cambia, nunca `var`. Solo `===` y `!==`.
- Identificadores en **español**, sin acentos ni ñ (`anio`, `dueno`). Excepciones: términos
  técnicos.
  - Variables y funciones: `camelCase`; funciones con verbo en infinitivo (`obtenerObras`).
  - Booleanos con `es`, `tiene`, `puede`, `esta` (`esSupervisor`).
  - Manejadores de evento `manejarX`; props de evento `onX` (`onPresionar`).
  - Componentes, pantallas, tipos e interfaces: `PascalCase`, interfaces sin prefijo `I`;
    props `NombreComponenteProps`.
  - Enumeraciones `PascalCase` con valores `UPPER_SNAKE_CASE`. Constantes globales
    `UPPER_SNAKE_CASE`.
  - Hooks `useNombre`. Archivos de componente `PascalCase.tsx`; otros `camelCase.ts`; carpetas en
    minúsculas.
  - Sin abreviaturas poco claras; se permiten `id`, `url`, `api`.
- **Encabezado obligatorio** en todo archivo nuevo, antes de las importaciones:

  ```ts
  /**
   * @archivo NombreArchivo.ts
   * @proyecto Civil Trace
   * @descripcion Qué hace y dónde se usa.
   * @autor Nombre completo de quien lo crea (la persona que dirige a Claude Code)
   * @fecha DD/MM/AAAA
   * @version 1.0.0
   * @requerimientos RF-XX Nombre, RNF-XX Nombre
   * @historial DD/MM/AAAA - Autor - Cambio
   */
  ```

- Secciones numeradas en este orden: `// 1. Importaciones` (externas, línea en blanco, internas
  con alias `@/`), `// 2. Tipos e interfaces`, `// 3. Constantes del módulo`, `// 4. Componente o
  función principal` (estados, efectos, manejadores, return) y `// 5. Estilos`
  (`StyleSheet.create` en un objeto `estilos`; solo en archivos de interfaz). Un componente
  principal por archivo; ~250 líneas como máximo.
- Comentarios en español que expliquen **por qué**, no qué. JSDoc (`@param`, `@returns`,
  `@throws`) en funciones exportadas, servicios y hooks. Sin código comentado.
  `// TODO(nombre): ...` solo si se crea la tarea correspondiente.
- Valores de negocio como constantes con nombre (`LIMITE_FALTAS`,
  `TOLERANCIA_MINUTOS_POR_DEFECTO`).
- Formato con Prettier (`semi`, `singleQuote`, `tabWidth 2`, `printWidth 100`,
  `trailingComma all`, `bracketSpacing`, `endOfLine lf`), llaves siempre, estilo K&R, 2 espacios.
- Toda llamada al servidor va en `try/catch` y muestra un mensaje claro en español al usuario.
- ESLint (TypeScript + React) y Prettier DEBEN pasar sin errores antes de abrir un pull request.

**Razón:** un estándar único hace el código legible y revisable por todo el equipo.

### III. Pruebas primero, ligadas al plan de pruebas

1. Cada requerimiento implementado tiene pruebas automáticas **escritas antes o junto con** el
   código. Una tarea no está terminada si sus pruebas no existen o no pasan.
2. Cada caso del plan de pruebas (CP01–CP20, escenarios de éxito, alterno y fallo) tiene al menos
   una prueba automática con su clave en el nombre:
   `it('CP14-E3 rechaza un avance sin motivo', ...)`.
3. Herramientas:
   - API: Vitest + `app.inject()` de Fastify; integración contra PostgreSQL de `docker-compose`.
   - App móvil: `jest-expo` + React Native Testing Library.
   - Portal del cliente: Vitest + Testing Library; Playwright para los flujos de aceptar y
     rechazar.
4. Cobertura mínima de líneas: 80 % en servicios de la API; 60 % en la app y el portal.
5. Las pruebas no usan servicios reales de Azure: almacenamiento y correo se sustituyen con
   dobles.

**Razón:** las pruebas ligadas al plan demuestran el cumplimiento de cada criterio de aceptación.

### IV. Seguridad y datos

1. Ningún secreto en el código, en Git, en el chat ni en Figma. Local: `.env` (en `.gitignore`).
   Azure: Key Vault con referencias desde la configuración del App Service.
2. Toda ruta de la API valida su entrada con `zod`, exige token (salvo las públicas del portal) y
   comprueba rol y pertenencia a la empresa. Un usuario nunca ve datos de otra empresa.
3. Las rutas públicas del portal del cliente usan un token de enlace aleatorio (≥ 128 bits) y el
   código de un solo uso (6 dígitos, guardado como hash, vence en 10 minutos, máximo 5 intentos).
4. Fotos, logos y firmas se guardan en Blob Storage **privado**; se sirven a través de la API o con
   enlaces temporales. Cada firma guarda su huella SHA-256 para detectar alteraciones.
5. La firma del cliente es una constancia demostrativa: los textos dicen "aceptación" o
   "constancia" y nunca "firma electrónica" (no es firma electrónica avanzada).
6. Los registros que sirven como evidencia (avances aprobados, entregas aceptadas, asistencia) no
   se borran; los cambios guardan valor anterior, autor, fecha y motivo.
7. Datos personales conforme a la LFPDPPP: aviso de privacidad y solo los datos necesarios.

**Razón:** el sistema guarda evidencia de obra y datos de varias empresas; su integridad y
aislamiento son la base de la confianza del cliente.

### V. Azure y portabilidad al cliente

1. Toda la infraestructura se describe en **Terraform** (carpeta `infra/` de la API). Nada se crea
   a mano en el portal salvo que se registre y se importe después.
2. Los recursos que ya existen en `rg-civiltrace` (suscripción Azure for Students) se
   **importan** sin recrearse. `terraform plan` nunca debe mostrar `destroy` o `replace` de
   recursos existentes; si lo muestra, se detiene y se pregunta.
3. Región, nombres, niveles y suscripción son variables. Entornos: `estudiantes` (actual) y
   `cliente` (México Central, se crea desde cero al entregar).
4. Despliegue con GitHub Actions y OIDC (sin contraseñas guardadas). Las identidades tienen permiso
   solo sobre su grupo de recursos, nunca Propietario de la suscripción.
5. Cuidar el crédito de estudiante: niveles mínimos (B1, B1ms, LRS, Free) salvo que el equipo
   apruebe otro.

**Razón:** el sistema se entregará al cliente en su propia suscripción; debe poder recrearse sin
pasos manuales y sin poner en riesgo el entorno actual.

### VI. Forma de trabajar

1. Una rama por módulo y pull request revisado por otro integrante antes de unir a `main` /
   `master`.
2. Si un módulo toca API y app, se termina primero la API con sus pruebas.
3. Migraciones de Prisma con nombre descriptivo; nunca se edita una migración ya aplicada.
4. Las dudas de negocio se preguntan al equipo; no se inventan reglas. Se registran en
   `docs/decisiones.md`.
5. Antes de declarar una tarea terminada: lint, tipos, pruebas y revisión contra la pantalla de
   Figma.

**Razón:** la revisión cruzada y el registro de decisiones evitan retrabajo y reglas inventadas.

## Restricciones técnicas (stack)

El stack de la API no se cambia sin aprobación del equipo (detalle en `CLAUDE.md`):

- Node 24, TypeScript estricto, módulos ES, alias `@/` → `src/`.
- Fastify 5 con `@fastify/helmet`, `@fastify/rate-limit` y `@fastify/jwt` (acceso + refresco con
  rotación).
- Prisma 7 + PostgreSQL 17; zod 4 para entrada y variables de entorno; argon2 para contraseñas.
- `@azure/storage-blob` + `@azure/identity` para fotos, logos y firmas.
- Errores con `ErrorHttp` y mensajes en español, sin trazas ni datos internos.
- La ruta `/almacenamiento-prueba` DEBE quedar deshabilitada cuando `NODE_ENV=production`.

## Puertas de calidad

Una tarea, plan o pull request solo avanza si cumple todo lo siguiente:

- `npm run typecheck`, `npm run lint` y `npm test` pasan sin errores.
- Las pruebas nuevas llevan la clave del caso del plan de pruebas y la cobertura no baja de los
  mínimos del principio III.
- Los archivos nuevos tienen el encabezado ECCT y citan sus claves del SRS vigente.
- El resultado se revisó contra la pantalla de Figma correspondiente (`node-id` de la spec).
- `terraform plan` (si aplica) no muestra `destroy` ni `replace` de recursos existentes.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica, guía o instrucción. Ante un
  conflicto, se detiene el trabajo y se pregunta al equipo.
- Las enmiendas se proponen por pull request que modifica este archivo, con la justificación del
  cambio, y requieren la aprobación del equipo. Las consecuencias se registran en
  `docs/decisiones.md`.
- Versionado semántico: MAJOR al quitar o redefinir un principio; MINOR al agregar un principio o
  sección o ampliar una regla de forma material; PATCH en aclaraciones y redacción.
- Toda revisión de pull request verifica el cumplimiento de estos principios. `CLAUDE.md` es la
  guía operativa del día a día y debe mantenerse consistente con esta constitución.

**Version**: 1.1.0 | **Ratified**: 2026-11-20 | **Last Amended**: 2026-11-24
