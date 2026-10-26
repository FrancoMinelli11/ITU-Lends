/**
 * Historial reciente de préstamos del alumno (finalizados y cancelados).
 * Sirve como registro personal y como referencia para el secreto de "cuánto duró".
 */

import { History } from 'lucide-react';
import { BadgePrestamo } from '../ui/Badge.jsx';
import { EmptyState } from '../ui/Feedback.jsx';
import { formatearFechaHora, formatearHora } from '../../utils/format.js';

export function HistorialPrestamos({ prestamos = [] }) {
  if (prestamos.length === 0) {
    return (
      <EmptyState
        Icono={History}
        titulo="Sin préstamos anteriores"
        descripcion="Cuando devuelvas un equipo, el registro va a aparecer en esta sección."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {prestamos.map((prestamo) => (
        <div key={prestamo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">
              <span className="font-mono">{prestamo.computadora?.codigo_inventario ?? '—'}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="text-slate-600">{prestamo.computadora?.modelo ?? ''}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Retirado el {formatearFechaHora(prestamo.fecha_hora_inicio)}
              {prestamo.fecha_hora_fin_real && ` · Devuelto ${formatearHora(prestamo.fecha_hora_fin_real)}`}
            </p>
          </div>
          <BadgePrestamo estado={prestamo.estado} />
        </div>
      ))}
    </div>
  );
}
