/**
 * =============================================================================
 *  Job de expiración de reservas
 * =============================================================================
 *  Una reserva PENDIENTE_RETIRO que nadie retira dentro de la tolerancia deja a
 *  la computadora bloqueada sin uso real. Este job recorre periódicamente las
 *  reservas vencidas, las cancela y libera la máquina, notificando a todos los
 *  clientes por Socket.io (ver prestamo.service.expirarReservasVencidas).
 *
 *  Notas de robustez:
 *   - Se ejecuta una vez al arrancar (el estado del inventario se autocorrige
 *     ante reinicios) y luego según INTERVALO_EXPIRACION_SEGUNDOS.
 *   - Un flag evita el solapamiento si una corrida tarda más que el intervalo.
 *   - El temporizador usa `unref()` para no impedir el cierre del proceso.
 * =============================================================================
 */

import { env } from '../config/env.js';
import { expirarReservasVencidas } from '../services/prestamo.service.js';

let temporizador = null;
let enEjecucion = false;

async function ejecutarCiclo() {
  if (enEjecucion) return; // Corrida anterior aún en curso.

  enEjecucion = true;
  try {
    const procesadas = await expirarReservasVencidas();
    if (procesadas > 0) {
      console.log(`[job:expiracion] ${procesadas} reserva(s) liberada(s) por falta de retiro.`);
    }
  } catch (error) {
    // El job nunca debe tumbar el servidor.
    console.error('[job:expiracion] Error en el ciclo:', error.message);
  } finally {
    enEjecucion = false;
  }
}

/** Arranca el job (idempotente). */
export function iniciarJobExpiracion() {
  if (temporizador) return;

  const intervaloMs = Math.max(10, env.negocio.intervaloExpiracionSegundos) * 1000;

  void ejecutarCiclo(); // Corrida inicial inmediata.
  temporizador = setInterval(ejecutarCiclo, intervaloMs);
  temporizador.unref?.();

  console.log(`[job:expiracion] Activo: libera reservas vencidas cada ${intervaloMs / 1000}s.`);
}

/** Detiene el job durante el apagado ordenado. */
export function detenerJobExpiracion() {
  if (!temporizador) return;
  clearInterval(temporizador);
  temporizador = null;
  console.log('[job:expiracion] Detenido.');
}
