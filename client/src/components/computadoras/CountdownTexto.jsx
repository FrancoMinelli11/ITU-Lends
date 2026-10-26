/**
 * Contador regresivo visual.
 * El valor se recalcula cada segundo con la hora del servidor (ver utils/reloj).
 */

import { Clock, TimerReset } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown.js';

const VARIANTES = {
  neutro: 'text-slate-600',
  aviso: 'text-amber-600',
  urgente: 'text-rose-600',
  exito: 'text-emerald-600',
};

export function CountdownTexto({
  hasta,
  prefijo = '',
  vacio = '—',
  umbralUrgente = 300, // 5 minutos
  className = '',
  mostrarIcono = true,
}) {
  const { segundos, texto, activo, vencido } = useCountdown(hasta);

  if (!activo) {
    return <span className={`text-sm text-slate-400 ${className}`}>{vacio}</span>;
  }

  const variante = vencido ? 'exito' : segundos <= umbralUrgente ? 'urgente' : 'neutro';
  const Icono = variante === 'urgente' ? TimerReset : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold cifras-fijas ${VARIANTES[variante]} ${className}`}
      title="Tiempo restante según el reloj del servidor"
    >
      {mostrarIcono && <Icono className="h-4 w-4" aria-hidden="true" />}
      {prefijo && <span className="font-normal text-slate-500">{prefijo}</span>}
      {texto}
    </span>
  );
}
