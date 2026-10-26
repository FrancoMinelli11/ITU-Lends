/**
 * =============================================================================
 *  Contrato de eventos de Socket.io (espejo del backend)
 * =============================================================================
 *  Mantener los nombres en un solo archivo evita "strings mágicos" dispersos y
 *  desincronizaciones entre cliente y servidor.
 * =============================================================================
 */

export const EVENTOS = Object.freeze({
  // Servidor -> cliente
  CONECTADO: 'conectado',
  COMPUTADORA_ACTUALIZADA: 'computadora_actualizada',
  NUEVO_PRESTAMO: 'nuevo_prestamo',
  PRESTAMO_ACTUALIZADO: 'prestamo_actualizado',
  RESERVA_EXPIRADA: 'reserva_expirada',
  PRESTAMO_POR_VENCER: 'prestamo_por_vencer',
  // Cliente -> servidor
  SINCRONIZAR_HORA: 'sincronizar_hora',
});

/** Estados de la conexión expuestos a la UI. */
export const ESTADO_CONEXION = Object.freeze({
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
  RECONECTANDO: 'reconectando',
  DESCONECTADO: 'desconectado',
});
