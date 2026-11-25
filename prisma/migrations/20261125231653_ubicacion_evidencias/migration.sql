-- AlterTable
ALTER TABLE "AvanceActividad" ADD COLUMN     "latitud" DECIMAL(9,6),
ADD COLUMN     "longitud" DECIMAL(9,6),
ADD COLUMN     "precisionMetros" DOUBLE PRECISION,
ADD COLUMN     "referenciaUbicacion" TEXT;
