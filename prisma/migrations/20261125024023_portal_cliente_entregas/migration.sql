-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('ENVIADA', 'ACEPTADA', 'CON_OBSERVACIONES');

-- CreateEnum
CREATE TYPE "EstadoEnvioEnlace" AS ENUM ('ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "EnlacePortal" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenCifrado" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEnvioEn" TIMESTAMP(3),
    "estadoEnvio" "EstadoEnvioEnlace",

    CONSTRAINT "EnlacePortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entrega" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "enviadaPorId" TEXT,
    "enviadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'ENVIADA',
    "nombreCliente" TEXT,
    "observaciones" TEXT,
    "firmaBlob" TEXT,
    "firmaSha256" TEXT,
    "respondidaEn" TIMESTAMP(3),
    "reporteBlob" TEXT,
    "actaBlob" TEXT,
    "actaSha256" TEXT,

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaActividad" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoActividad" NOT NULL,
    "fechaEntrega" DATE NOT NULL,
    "fechaTerminada" DATE,

    CONSTRAINT "EntregaActividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaAvance" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "entregaActividadId" TEXT NOT NULL,
    "avanceId" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntregaAvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoEntrega" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "usadoEn" TIMESTAMP(3),
    "invalidado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CodigoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnlacePortal_obraId_key" ON "EnlacePortal"("obraId");

-- CreateIndex
CREATE UNIQUE INDEX "EnlacePortal_tokenHash_key" ON "EnlacePortal"("tokenHash");

-- CreateIndex
CREATE INDEX "EnlacePortal_empresaId_idx" ON "EnlacePortal"("empresaId");

-- CreateIndex
CREATE INDEX "Entrega_empresaId_idx" ON "Entrega"("empresaId");

-- CreateIndex
CREATE INDEX "Entrega_obraId_idx" ON "Entrega"("obraId");

-- CreateIndex
CREATE INDEX "EntregaActividad_actividadId_idx" ON "EntregaActividad"("actividadId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaActividad_entregaId_actividadId_key" ON "EntregaActividad"("entregaId", "actividadId");

-- CreateIndex
CREATE INDEX "EntregaAvance_avanceId_idx" ON "EntregaAvance"("avanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaAvance_entregaId_avanceId_key" ON "EntregaAvance"("entregaId", "avanceId");

-- CreateIndex
CREATE INDEX "CodigoEntrega_entregaId_idx" ON "CodigoEntrega"("entregaId");

-- AddForeignKey
ALTER TABLE "EnlacePortal" ADD CONSTRAINT "EnlacePortal_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnlacePortal" ADD CONSTRAINT "EnlacePortal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_enviadaPorId_fkey" FOREIGN KEY ("enviadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaActividad" ADD CONSTRAINT "EntregaActividad_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaActividad" ADD CONSTRAINT "EntregaActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAvance" ADD CONSTRAINT "EntregaAvance_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAvance" ADD CONSTRAINT "EntregaAvance_entregaActividadId_fkey" FOREIGN KEY ("entregaActividadId") REFERENCES "EntregaActividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaAvance" ADD CONSTRAINT "EntregaAvance_avanceId_fkey" FOREIGN KEY ("avanceId") REFERENCES "AvanceActividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodigoEntrega" ADD CONSTRAINT "CodigoEntrega_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
