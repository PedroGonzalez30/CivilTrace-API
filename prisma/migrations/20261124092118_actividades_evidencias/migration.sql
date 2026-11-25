-- CreateEnum
CREATE TYPE "TipoAvance" AS ENUM ('DIARIO', 'TERMINADO');

-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN     "descripcion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fechaInicio" DATE;

-- AlterTable
ALTER TABLE "AvanceActividad" ADD COLUMN     "observacion" TEXT,
ADD COLUMN     "revisadoEn" TIMESTAMP(3),
ADD COLUMN     "revisadoPorId" TEXT,
ADD COLUMN     "tipo" "TipoAvance" NOT NULL DEFAULT 'DIARIO';

-- AddForeignKey
ALTER TABLE "AvanceActividad" ADD CONSTRAINT "AvanceActividad_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
