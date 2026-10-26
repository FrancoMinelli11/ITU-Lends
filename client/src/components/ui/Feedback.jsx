/**
 * Alertas y estados vacíos.
 */

import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle } from 'lucide-react';

const VARIANTES = {
  info: { clase: 'bg-slate-50 text-slate-700 ring-slate-200', Icono: Info, iconoClase: 'text-slate-500' },
  exito: { clase: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icono: CheckCircle2, iconoClase: 'text-emerald-600' },
  error: { clase: 'bg-rose-50 text-rose-800 ring-rose-200', Icono: XCircle, iconoClase: 'text-rose-600' },
  aviso: { clase: 'bg-amber-50 text-amber-800 ring-amber-200', Icono: AlertTriangle, iconoClase: 'text-amber-600' },
};

/**
 * Alerta con variantes semánticas.
 * @param {{ variante?: 'info'|'exito'|'error'|'aviso', titulo?: string, detalles?: Array<{campo?:string,mensaje:string}>, children?: any, className?: string }} props
 */
export function Alert({ variante = 'info', titulo, detalles, children, className = '' }) {
  const meta = VARIANTES[variante] ?? VARIANTES.info;
  const { Icono } = meta;

  return (
    <div
      role={variante === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl p-4 text-sm ring-1 ring-inset ${meta.clase} ${className}`}
    >
      <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${meta.iconoClase}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={titulo ? 'mt-1' : ''}>{children}</div>}

        {/* Detalle campo por campo de los errores de validación (HTTP 400) */}
        {Array.isArray(detalles) && detalles.length > 0 && (
          <ul className={`list-disc space-y-0.5 pl-4 ${titulo || children ? 'mt-2' : ''}`}>
            {detalles.map((detalle, indice) => (
              <li key={`${detalle.campo ?? 'general'}-${indice}`}>
                {detalle.campo ? <span className="font-medium">{detalle.campo}: </span> : null}
                {detalle.mensaje}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Estado vacío reutilizable (listas sin resultados, catálogos, etc.). */
export function EmptyState({ Icono = Inbox, titulo, descripcion, accion, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center ${className}`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icono className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-700">{titulo}</p>
        {descripcion && <p className="mt-1 max-w-sm text-sm text-slate-500">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
