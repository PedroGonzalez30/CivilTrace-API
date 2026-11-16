-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'SUPERVISOR', 'TRABAJADOR');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigoTrabajadores" TEXT NOT NULL,
    "codigoSupervisores" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "contrasenaHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "empresaId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFinal" DATE NOT NULL,
    "cliente" TEXT,
    "empresaId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRefresco" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "revocadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRefresco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_codigoTrabajadores_key" ON "Empresa"("codigoTrabajadores");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_codigoSupervisores_key" ON "Empresa"("codigoSupervisores");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");

-- CreateIndex
CREATE INDEX "Obra_empresaId_idx" ON "Obra"("empresaId");

-- CreateIndex
CREATE INDEX "Obra_supervisorId_idx" ON "Obra"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRefresco_tokenHash_key" ON "TokenRefresco"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRefresco_usuarioId_idx" ON "TokenRefresco"("usuarioId");

-- CreateIndex
CREATE INDEX "TokenRefresco_familiaId_idx" ON "TokenRefresco"("familiaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenRefresco" ADD CONSTRAINT "TokenRefresco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
