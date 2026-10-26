-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ALUMNO', 'SECRETARIO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'SUSPENDIDO');

-- CreateEnum
CREATE TYPE "EstadoComputadora" AS ENUM ('DISPONIBLE', 'RESERVADA', 'EN_USO', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('PENDIENTE_RETIRO', 'ACTIVO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoReporte" AS ENUM ('PENDIENTE', 'EN_REVISION', 'RESUELTO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" VARCHAR(120) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'ALUMNO',
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computadoras" (
    "id" TEXT NOT NULL,
    "codigo_inventario" VARCHAR(40) NOT NULL,
    "modelo" VARCHAR(120) NOT NULL,
    "especificaciones" TEXT,
    "estado" "EstadoComputadora" NOT NULL DEFAULT 'DISPONIBLE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "computadoras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "computadora_id" TEXT NOT NULL,
    "fecha_hora_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_hora_fin_estimada" TIMESTAMP(3) NOT NULL,
    "fecha_hora_fin_real" TIMESTAMP(3),
    "token_validacion" VARCHAR(4) NOT NULL,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'PENDIENTE_RETIRO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_falla" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "computadora_id" TEXT NOT NULL,
    "prestamo_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reportes_falla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_estado_idx" ON "usuarios"("rol", "estado");

-- CreateIndex
CREATE INDEX "usuarios_apellido_nombre_idx" ON "usuarios"("apellido", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "computadoras_codigo_inventario_key" ON "computadoras"("codigo_inventario");

-- CreateIndex
CREATE INDEX "computadoras_estado_idx" ON "computadoras"("estado");

-- CreateIndex
CREATE INDEX "prestamos_usuario_id_estado_idx" ON "prestamos"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "prestamos_computadora_id_estado_idx" ON "prestamos"("computadora_id", "estado");

-- CreateIndex
CREATE INDEX "prestamos_token_validacion_estado_idx" ON "prestamos"("token_validacion", "estado");

-- CreateIndex
CREATE INDEX "prestamos_estado_fecha_hora_fin_estimada_idx" ON "prestamos"("estado", "fecha_hora_fin_estimada");

-- CreateIndex
CREATE INDEX "reportes_falla_computadora_id_estado_idx" ON "reportes_falla"("computadora_id", "estado");

-- CreateIndex
CREATE INDEX "reportes_falla_estado_creado_en_idx" ON "reportes_falla"("estado", "creado_en");

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_computadora_id_fkey" FOREIGN KEY ("computadora_id") REFERENCES "computadoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_computadora_id_fkey" FOREIGN KEY ("computadora_id") REFERENCES "computadoras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
