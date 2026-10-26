/**
 * =============================================================================
 *  Utilidades de fecha/hora
 * =============================================================================
 *  Toda la lógica temporal del backend pasa por acá para evitar duplicar
 *  aritmética de fechas en los servicios y mantener un único lugar de cambio.
 * =============================================================================
 */

/** Suma (o resta, con valores negativos) minutos a una fecha. */
export function sumarMinutos(fecha, minutos) {
  return new Date(new Date(fecha).getTime() + minutos * 60 * 1000);
}

/** Diferencia en segundos entre dos fechas (b - a). */
export function diferenciaEnSegundos(b, a = new Date()) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

/** Cantidad de segundos restantes hasta una fecha, nunca negativa. */
export function segundosRestantesHasta(fecha, ahora = new Date()) {
  return Math.max(0, diferenciaEnSegundos(fecha, ahora));
}

/** true si `fecha` ya pasó respecto de `ahora`. */
export function yaPaso(fecha, ahora = new Date()) {
  return new Date(fecha).getTime() <= new Date(ahora).getTime();
}

/** true si `fecha` es posterior a `ahora` (con tolerancia opcional en ms). */
export function esFuturo(fecha, ahora = new Date(), toleranciaMs = 0) {
  return new Date(fecha).getTime() > new Date(ahora).getTime() + toleranciaMs;
}

/** Formatea una fecha en hora local legible (solo para logs). */
export function formatearParaLog(fecha = new Date()) {
  return new Date(fecha).toLocaleString('es-AR', { hour12: false });
}
