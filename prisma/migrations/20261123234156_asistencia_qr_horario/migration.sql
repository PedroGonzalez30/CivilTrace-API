-- Feature 001: asistencia con QR, horario por obra y calendario (RF-19, RF-27, RF-56, RF-58, RF-60).

-- CreateEnum
CREATE TYPE "AlcanceHorario" AS ENUM ('GENERAL', 'DIA');

-- CreateEnum
CREATE TYPE "TipoJornada" AS ENUM ('COMPLETA', 'RETARDO', 'MEDIA_JORNADA', 'SALIDA_TEMPRANA', 'FALTA');

-- CreateEnum
CREATE TYPE "MotivoAsistencia" AS ENUM ('CITA_MEDICA', 'ENFERMEDAD', 'PERMISO_PERSONAL', 'ASUNTO_FAMILIAR', 'OTRO');

-- CreateEnum
CREATE TYPE "EfectoPago" AS ENUM ('PAGO_COMPLETO', 'MEDIO_DIA', 'SIN_PAGO');

-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Tijuana';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "oficio" TEXT;

-- CreateTable
CREATE TABLE "HorarioObra" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "alcance" "AlcanceHorario" NOT NULL,
    "fecha" DATE,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,
    "toleranciaMinutos" INTEGER NOT NULL,
    "diasLaborales" INTEGER[],
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorarioObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredencialAsistencia" (
    "id" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredencialAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAsistencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "entradaEn" TIMESTAMPTZ(3),
    "entradaLatitud" DECIMAL(9,6),
    "entradaLongitud" DECIMAL(9,6),
    "entradaSinConexion" BOOLEAN NOT NULL DEFAULT false,
    "entradaIdLocal" TEXT,
    "entradaRegistradaPorId" TEXT,
    "salidaEn" TIMESTAMPTZ(3),
    "salidaLatitud" DECIMAL(9,6),
    "salidaLongitud" DECIMAL(9,6),
    "salidaSinConexion" BOOLEAN NOT NULL DEFAULT false,
    "salidaIdLocal" TEXT,
    "salidaRegistradaPorId" TEXT,
    "tipoJornada" "TipoJornada" NOT NULL DEFAULT 'COMPLETA',
    "motivo" "MotivoAsistencia",
    "efectoPago" "EfectoPago" NOT NULL DEFAULT 'PAGO_COMPLETO',
    "anotacion" TEXT,
    "esDiaLaborable" BOOLEAN NOT NULL,
    "horarioEntrada" TEXT,
    "horarioSalida" TEXT,
    "toleranciaMinutos" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CambioAsistencia" (
    "id" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "motivo" TEXT,
    "autorId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioAsistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorarioObra_obraId_alcance_fecha_creadoEn_idx" ON "HorarioObra"("obraId", "alcance", "fecha", "creadoEn");

-- CreateIndex
CREATE INDEX "HorarioObra_empresaId_idx" ON "HorarioObra"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "CredencialAsistencia_trabajadorId_key" ON "CredencialAsistencia"("trabajadorId");

-- CreateIndex
CREATE UNIQUE INDEX "CredencialAsistencia_token_key" ON "CredencialAsistencia"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CredencialAsistencia_tokenHash_key" ON "CredencialAsistencia"("tokenHash");

-- CreateIndex
CREATE INDEX "CredencialAsistencia_empresaId_idx" ON "CredencialAsistencia"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_entradaIdLocal_key" ON "RegistroAsistencia"("entradaIdLocal");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_salidaIdLocal_key" ON "RegistroAsistencia"("salidaIdLocal");

-- CreateIndex
CREATE INDEX "RegistroAsistencia_empresaId_idx" ON "RegistroAsistencia"("empresaId");

-- CreateIndex
CREATE INDEX "RegistroAsistencia_obraId_fecha_idx" ON "RegistroAsistencia"("obraId", "fecha");

-- CreateIndex
CREATE INDEX "RegistroAsistencia_trabajadorId_fecha_idx" ON "RegistroAsistencia"("trabajadorId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAsistencia_trabajadorId_obraId_fecha_key" ON "RegistroAsistencia"("trabajadorId", "obraId", "fecha");

-- CreateIndex
CREATE INDEX "CambioAsistencia_registroId_idx" ON "CambioAsistencia"("registroId");

-- AddForeignKey
ALTER TABLE "HorarioObra" ADD CONSTRAINT "HorarioObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioObra" ADD CONSTRAINT "HorarioObra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioObra" ADD CONSTRAINT "HorarioObra_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredencialAsistencia" ADD CONSTRAINT "CredencialAsistencia_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredencialAsistencia" ADD CONSTRAINT "CredencialAsistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_entradaRegistradaPorId_fkey" FOREIGN KEY ("entradaRegistradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAsistencia" ADD CONSTRAINT "RegistroAsistencia_salidaRegistradaPorId_fkey" FOREIGN KEY ("salidaRegistradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioAsistencia" ADD CONSTRAINT "CambioAsistencia_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "RegistroAsistencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CambioAsistencia" ADD CONSTRAINT "CambioAsistencia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
