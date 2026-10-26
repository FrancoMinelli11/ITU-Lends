/**
 * =============================================================================
 *  Reglas de negocio replicadas en el cliente (solo para validación de UX)
 * =============================================================================
 *  IMPORTANTE: la fuente de verdad es el backend (variables de entorno en
 *  server/.env). Estos valores se usan exclusivamente para deshabilitar botones
 *  y validar formularios antes de enviar, evitando round-trips innecesarios.
 *  Si se cambian en el servidor, conviene mantenerlos alineados acá.
 * =============================================================================
 */

export const REGLAS = Object.freeze({
  /** Anticipación máxima para programar una reserva (ANTICIPACION_MAXIMA_MINUTOS). */
  anticipacionMaximaMinutos: 60,
  /** Tolerancia para retirar una reserva antes de que expire (TOLERANCIA_CHECK_IN_MINUTOS). */
  toleranciaCheckInMinutos: 15,
  /** Minutos antes del inicio programado en que se habilita el check-in. */
  anticipacionRetiroMinutos: 10,
  /** Minutos de aviso preventivo antes de que venza un préstamo activo (ALERTA_VENCIMIENTO_MINUTOS). */
  alertaVencimientoMinutos: 15,
  /** Minutos que suma cada extensión del préstamo (EXTENSION_PRESTAMO_MINUTOS). */
  extensionMinutos: 60,
  /** Minutos de observaciones que admite la devolución. */
  maximoObservaciones: 300,
});
