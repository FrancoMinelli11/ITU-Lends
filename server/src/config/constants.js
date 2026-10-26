/**
 * =============================================================================
 *  Constantes del dominio
 * =============================================================================
 *  Los valores de negocio configurables provienen de `env`; acá se declaran las
 *  constantes *estructurales* (estados, eventos de socket, mensajes) que no
 *  deberían cambiar entre entornos y que son consumidas por varias capas.
 * =============================================================================
 */

// --- Estados (espejo de los enums de Prisma) --------------------------------
export const ROL = Object.freeze({
  ALUMNO: 'ALUMNO',
  SECRETARIO: 'SECRETARIO',
});

export const ESTADO_USUARIO = Object.freeze({
  ACTIVO: 'ACTIVO',
  SUSPENDIDO: 'SUSPENDIDO',
});

export const ESTADO_COMPUTADORA = Object.freeze({
  DISPONIBLE: 'DISPONIBLE',
  RESERVADA: 'RESERVADA',
  EN_USO: 'EN_USO',
  MANTENIMIENTO: 'MANTENIMIENTO',
});

export const ESTADO_PRESTAMO = Object.freeze({
  PENDIENTE_RETIRO: 'PENDIENTE_RETIRO',
  ACTIVO: 'ACTIVO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
  CANCELADO_NO_SHOW: 'CANCELADO_NO_SHOW',
});

/** Estados que "ocupan" a un alumno: solo puede tener uno a la vez. */
export const PRESTAMOS_VIGENTES = [ESTADO_PRESTAMO.PENDIENTE_RETIRO, ESTADO_PRESTAMO.ACTIVO];

/** Estados cerrados que aparecen en el historial (incluye la política de no-show). */
export const PRESTAMOS_HISTORIAL = [
  ESTADO_PRESTAMO.FINALIZADO,
  ESTADO_PRESTAMO.CANCELADO,
  ESTADO_PRESTAMO.CANCELADO_NO_SHOW,
];

// --- Severidad de los reportes de fallas (Sprint 3) -------------------------
export const SEVERIDAD_FALLA = Object.freeze({
  LEVE: 'LEVE',
  GRAVE: 'GRAVE',
  CRITICA: 'CRITICA',
});

/** Severidades que dejan la computadora fuera de servicio (MANTENIMIENTO). */
export const SEVERIDADES_CRITICAS = [SEVERIDAD_FALLA.GRAVE, SEVERIDAD_FALLA.CRITICA];

/** Workflow de un reporte de falla (espejo del enum EstadoReporte). */
export const ESTADO_REPORTE = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  EN_REVISION: 'EN_REVISION',
  RESUELTO: 'RESUELTO',
});

// --- Eventos de Socket.io (contrato estable cliente <-> servidor) -----------
export const EVENTOS_SOCKET = Object.freeze({
  // Servidor -> clientes
  CONECTADO: 'conectado',
  COMPUTADORA_ACTUALIZADA: 'computadora_actualizada',
  NUEVO_PRESTAMO: 'nuevo_prestamo',
  PRESTAMO_ACTUALIZADO: 'prestamo_actualizado',
  RESERVA_EXPIRADA: 'reserva_expirada',
  PRESTAMO_POR_VENCER: 'prestamo_por_vencer',
  // Cliente -> servidor (con ack)
  SINCRONIZAR_HORA: 'sincronizar_hora',
});

// --- Motivos de cancelación (trazabilidad en auditorías futuras) ------------
export const MOTIVO_CANCELACION = Object.freeze({
  ALUMNO: 'CANCELADO_POR_ALUMNO',
  EXPIRACION: 'EXPIRADO_POR_FALTA_DE_RETIRO',
  SECRETARIA: 'CANCELADO_POR_SECRETARIA',
});
