/**
 * =============================================================================
 *  Reloj sincronizado con el servidor
 * =============================================================================
 *  Problema: el reloj del dispositivo del alumno puede estar desfasado varios
 *  minutos, lo que rompería los contadores regresivos (mostraría "00:00" antes
 *  de tiempo, o tiempo de más).
 *
 *  Solución: el backend incluye `servidor_timestamp` en cada respuesta HTTP y en
 *  cada evento de Socket.io. Este módulo calcula el desfase (offset) y expone
 *  `ahora()`, que TODA la UI debe usar en lugar de `Date.now()`.
 *
 *  El desfase se recalcula con cada mensaje recibido, por lo que se autocorrige
 *  ante suspensión del dispositivo o cambios de hora.
 * =============================================================================
 */

let desfaseMs = 0; // servidor - cliente
let ultimaSincronizacion = null;
let sincronizado = false;

/**
 * Ajusta el desfase del reloj local contra una marca de tiempo del servidor.
 * @param {number} servidorTimestamp  ms (epoch) según el servidor.
 * @param {number} rttMs              latencia ida y vuelta medida (opcional).
 *                                    Se suma la mitad para estimar el momento
 *                                    en que el servidor generó el dato.
 */
export function ajustarConServidor(servidorTimestamp, rttMs = 0) {
  if (typeof servidorTimestamp !== 'number' || Number.isNaN(servidorTimestamp)) return;

  const candidato = servidorTimestamp + rttMs / 2 - Date.now();

  desfaseMs = candidato;
  ultimaSincronizacion = Date.now();
  sincronizado = true;
}

/** Hora actual corregida contra el servidor (ms epoch). */
export function ahora() {
  return Date.now() + desfaseMs;
}

/** Segundos restantes hasta una fecha ISO (nunca negativo). */
export function segundosHasta(fechaISO) {
  if (!fechaISO) return 0;
  return Math.max(0, Math.round((new Date(fechaISO).getTime() - ahora()) / 1000));
}

/** Segundos transcurridos desde una fecha ISO (nunca negativo). */
export function segundosDesde(fechaISO) {
  if (!fechaISO) return 0;
  return Math.max(0, Math.round((ahora() - new Date(fechaISO).getTime()) / 1000));
}

/** `true` si la fecha ya pasó según el reloj sincronizado. */
export function yaPaso(fechaISO) {
  if (!fechaISO) return false;
  return new Date(fechaISO).getTime() <= ahora();
}

/** Información de diagnóstico (se muestra en el pie de página en desarrollo). */
export function estadoReloj() {
  return { desfaseMs, sincronizado, ultimaSincronizacion };
}
