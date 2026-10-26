/**
 * =============================================================================
 *  AlertaVencimiento - Aviso flotante preventivo a los 15 minutos (Sprint 3)
 * =============================================================================
 *  Se muestra como banner flotante cuando a un préstamo ACTIVO le quedan
 *  <= REGLAS.alertaVencimientoMinutos de uso. Dos disparadores redundantes:
 *
 *   1. Cálculo local con el reloj del servidor (useCountdown): aunque el
 *      cliente pierda el evento por socket, el banner aparece a tiempo.
 *   2. El evento `prestamo_por_vencer` del backend: re-muestra el banner
 *      (útil si el alumno lo había descartado y la extensión venció de nuevo).
 *
 *  El alumno puede descartarlo; se reactiva solo si cambia el horario de
 *  cierre (por ejemplo, tras una extensión) o si vuelve a llegar el aviso
 *  del servidor para el mismo préstamo.
 * =============================================================================
 */

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { EVENTOS } from '../../constants/eventos.js';
import { REGLAS } from '../../constants/reglas.js';
import { ESTADO_PRESTAMO } from '../../constants/estados.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import { useSocketEvent } from '../../hooks/useSocketEvent.js';
import { formatearHora } from '../../utils/format.js';

export function AlertaVencimiento({ prestamo }) {
  const esActivo = prestamo?.estado === ESTADO_PRESTAMO.ACTIVO;
  const { segundos, texto, vencido } = useCountdown(esActivo ? prestamo.fecha_hora_fin_estimada : null);

  const [descartada, setDescartada] = useState(false);
  // Clave que reactiva el banner: cambia con el horario de cierre y con cada
  // aviso nuevo del servidor para este préstamo.
  const [claveActiva, setClaveActiva] = useState(null);

  const umbralSegundos = REGLAS.alertaVencimientoMinutos * 60;
  const enAlerta = esActivo && segundos > 0 && segundos <= umbralSegundos;

  // Cada vez que cambia el cierre (extensión) o llega un aviso del servidor,
  // el descarte previo deja de aplicar.
  useEffect(() => {
    if (!esActivo) {
      setClaveActiva(null);
      setDescartada(false);
      return;
    }
    setClaveActiva(`${prestamo.id}:${prestamo.fecha_hora_fin_estimada}`);
    setDescartada(false);
  }, [esActivo, prestamo?.id, prestamo?.fecha_hora_fin_estimada]);

  useSocketEvent(EVENTOS.PRESTAMO_POR_VENCER, ({ prestamo: avisado } = {}) => {
    if (avisado?.id && avisado.id === prestamo?.id) setDescartada(false);
  });

  if (!enAlerta || descartada) return null;

  return (
    <div
      role="alert"
      className="animate-fade-in fixed inset-x-4 bottom-4 z-40 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
      data-clave={claveActiva}
    >
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg shadow-amber-900/10 ring-1 ring-amber-300/60">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-amber-900">
                Tu turno está por vencer
              </p>
              <button
                type="button"
                onClick={() => setDescartada(true)}
                className="rounded-lg p-1 text-amber-700 transition hover:bg-amber-100"
                aria-label="Descartar aviso"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-1 text-xs text-amber-800">
              {prestamo.computadora?.codigo_inventario} vence a las{' '}
              <strong>{formatearHora(prestamo.fecha_hora_fin_estimada)}</strong>.
            </p>

            <p className="mt-2 cifras-fijas text-lg font-semibold text-amber-900">
              {vencido ? 'Tiempo agotado' : `Quedan ${texto}`}
            </p>

            <p className="mt-1 text-xs text-amber-700">
              Devolvé el equipo en secretaría o solicitá la extensión desde tu tarjeta de préstamo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
