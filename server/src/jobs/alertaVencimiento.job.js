/**
 * =============================================================================
 *  Job de alerta preventiva de vencimiento (Sprint 3)
 * =============================================================================
 *  Detecta préstamos ACTIVOS a los que les quedan <= ALERTA_VENCIMIENTO_MINUTOS
 *  de uso y emite `prestamo_por_vencer` a la secretaría y al alumno dueño, de
 *  modo que ambos puedan preparar la devolución a tiempo.
 *
 *  Idempotencia:
 *   - Cada préstamo lleva la bandera `alerta_vencimiento_enviada`; se pone en
 *     true con un compare-and-swap (`updateMany` sobre la bandera en false), de
 *     modo que un solapamiento de corridas nunca duplica el aviso.
 *   - Al extender el préstamo el servicio vuelve a poner la bandera en false,
 *     por lo que el nuevo vencimiento avisa exactamente una vez más.
 *
 *  Notas de robustez (mismo patrón que expiracionReservas.job):
 *   - Corre una vez al arrancar y luego cada INTERVALO_ALERTA_SEGUNDOS.
 *   - Un flag evita el solapamiento si una corrida tarda más que el intervalo.
 *   - El temporizador usa `unref()` para no impedir el cierre del proceso.
 * =============================================================================
 */

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ESTADO_PRESTAMO } from '../config/constants.js';
import { sumarMinutos } from '../utils/fechas.js';
import { serializarPrestamo } from '../utils/serializers.js';
import { INCLUIR_DETALLE_PRESTAMO } from '../data/includes.js';
import * as realtime from '../realtime/socket.js';

let temporizador = null;
let enEjecucion = false;

/**
 * Emite la alerta de vencimiento a los préstamos que corresponda.
 * @returns {Promise<number>} cantidad de alertas emitidas
 */
export async function avisarPrestamosPorVencer() {
  const ahora = new Date();
  const limiteSuperior = sumarMinutos(ahora, env.negocio.alertaVencimientoMinutos);

  const porVencer = await prisma.prestamo.findMany({
    where: {
      estado: ESTADO_PRESTAMO.ACTIVO,
      alerta_vencimiento_enviada: false,
      // Quedan entre 1 minuto y el umbral: todavía no venció.
      fecha_hora_fin_estimada: { gt: ahora, lte: limiteSuperior },
    },
    include: INCLUIR_DETALLE_PRESTAMO,
    take: 100,
  });

  let avisados = 0;
  for (const prestamo of porVencer) {
    try {
      // CAS: si otra corrida (o una extensión) lo modificó, no se emite.
      const cambio = await prisma.prestamo.updateMany({
        where: { id: prestamo.id, estado: ESTADO_PRESTAMO.ACTIVO, alerta_vencimiento_enviada: false },
        data: { alerta_vencimiento_enviada: true },
      });
      if (cambio.count === 0) continue;

      // Sin PIN: el evento viaja a salas privadas, pero aun así no se expone.
      realtime.emitirPrestamoPorVencer(serializarPrestamo(prestamo, { mostrarPin: false, ahora }));
      avisados += 1;
    } catch (error) {
      // Un préstamo problemático no debe frenar el resto del lote.
      console.error(`[job:alerta] Falló al avisar el préstamo ${prestamo.id}:`, error.message);
    }
  }

  return avisados;
}

async function ejecutarCiclo() {
  if (enEjecucion) return; // Corrida anterior aún en curso.

  enEjecucion = true;
  try {
    const avisados = await avisarPrestamosPorVencer();
    if (avisados > 0) {
      console.log(`[job:alerta] ${avisados} préstamo(s) por vencer avisado(s) a sus dueños y a secretaría.`);
    }
  } catch (error) {
    // El job nunca debe tumbar el servidor.
    console.error('[job:alerta] Error en el ciclo:', error.message);
  } finally {
    enEjecucion = false;
  }
}

/** Arranca el job (idempotente). */
export function iniciarJobAlerta() {
  if (temporizador) return;

  const intervaloMs = Math.max(5, env.negocio.intervaloAlertaSegundos) * 1000;

  void ejecutarCiclo(); // Corrida inicial inmediata.
  temporizador = setInterval(ejecutarCiclo, intervaloMs);
  temporizador.unref?.();

  console.log(
    `[job:alerta] Activo: avisa préstamos con <= ${env.negocio.alertaVencimientoMinutos} min cada ${intervaloMs / 1000}s.`,
  );
}

/** Detiene el job durante el apagado ordenado. */
export function detenerJobAlerta() {
  if (!temporizador) return;
  clearInterval(temporizador);
  temporizador = null;
  console.log('[job:alerta] Detenido.');
}
