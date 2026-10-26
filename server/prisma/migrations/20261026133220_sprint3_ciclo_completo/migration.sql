-- CreateEnum
CREATE TYPE "SeveridadFalla" AS ENUM ('LEVE', 'GRAVE', 'CRITICA');

-- AlterEnum
ALTER TYPE "EstadoPrestamo" ADD VALUE 'CANCELADO_NO_SHOW';

-- AlterTable
ALTER TABLE "prestamos" ADD COLUMN     "alerta_vencimiento_enviada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "observaciones_devolucion" TEXT;

-- AlterTable
ALTER TABLE "reportes_falla" ADD COLUMN     "resuelto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "severidad" "SeveridadFalla" NOT NULL DEFAULT 'LEVE';

-- CreateIndex
CREATE INDEX "reportes_falla_prestamo_id_idx" ON "reportes_falla"("prestamo_id");
