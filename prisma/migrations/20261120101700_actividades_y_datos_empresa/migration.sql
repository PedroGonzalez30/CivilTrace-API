-- Cambios del esquema que ya estaban en schema.prisma pero sin migración versionada
-- (actividades, avances y datos de empresa). En Azure ya existen: allá esta migración se marca
-- como aplicada con `prisma migrate resolve --applied` (ver docs/decisiones.md, P-05).

-- CreateEnum
CREATE TYPE "EstadoActividad" AS ENUM ('ACTIVA', 'TERMINADA');

-- CreateEnum
CREATE TYPE "EstadoAvance" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "correo" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "logoBlob" TEXT;

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaEntrega" DATE NOT NULL,
    "fechaTerminada" DATE,
    "estado" "EstadoActividad" NOT NULL DEFAULT 'ACTIVA',
    "obraId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "responsableId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvanceActividad" (
    "id" TEXT NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "fotoBlob" TEXT NOT NULL,
    "fotoTipo" TEXT NOT NULL DEFAULT 'image/jpeg',
    "estado" "EstadoAvance" NOT NULL DEFAULT 'APROBADO',
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actividadId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "registradoPorId" TEXT,

    CONSTRAINT "AvanceActividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Actividad_empresaId_idx" ON "Actividad"("empresaId");

-- CreateIndex
CREATE INDEX "Actividad_obraId_idx" ON "Actividad"("obraId");

-- CreateIndex
CREATE INDEX "Actividad_responsableId_idx" ON "Actividad"("responsableId");

-- CreateIndex
CREATE INDEX "AvanceActividad_empresaId_idx" ON "AvanceActividad"("empresaId");

-- CreateIndex
CREATE INDEX "AvanceActividad_actividadId_idx" ON "AvanceActividad"("actividadId");

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvanceActividad" ADD CONSTRAINT "AvanceActividad_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvanceActividad" ADD CONSTRAINT "AvanceActividad_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvanceActividad" ADD CONSTRAINT "AvanceActividad_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
