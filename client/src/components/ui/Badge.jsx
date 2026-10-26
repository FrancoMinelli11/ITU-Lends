/**
 * Insignias de estado (badges).
 * Todas las clases Tailwind se declaran completas en constants/estados.js para
 * que el compilador las detecte.
 */

import { META_ESTADO_COMPUTADORA, META_ESTADO_PRESTAMO } from '../../constants/estados.js';

export function Badge({ children, clase = 'bg-slate-100 text-slate-700', punto = null, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${clase} ${className}`}
    >
      {punto && <span className={`h-1.5 w-1.5 rounded-full ${punto}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Insignia con el estado de una computadora. */
export function BadgeComputadora({ estado, className = '' }) {
  const meta = META_ESTADO_COMPUTADORA[estado] ?? META_ESTADO_COMPUTADORA.MANTENIMIENTO;
  return (
    <Badge clase={meta.insignia} punto={meta.punto} className={className}>
      {meta.etiqueta}
    </Badge>
  );
}

/** Insignia con el estado de un préstamo. */
export function BadgePrestamo({ estado, className = '' }) {
  const meta = META_ESTADO_PRESTAMO[estado] ?? META_ESTADO_PRESTAMO.CANCELADO;
  return (
    <Badge clase={meta.insignia} punto={meta.punto} className={className}>
      {meta.etiqueta}
    </Badge>
  );
}
