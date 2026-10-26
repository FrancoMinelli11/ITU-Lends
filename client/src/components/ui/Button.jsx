/**
 * Botón polimórfico con variantes, tamaños, estado de carga e ícono opcional.
 */

import { Spinner } from './Spinner.jsx';

const VARIANTES = {
  primario:
    'bg-marca-600 text-white shadow-sm hover:bg-marca-700 active:bg-marca-800 disabled:bg-marca-300 disabled:shadow-none',
  secundario:
    'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
  exito: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800',
  peligro: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
  advertir: 'bg-amber-500 text-white shadow-sm hover:bg-amber-600 active:bg-amber-700',
  fantasma: 'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200',
};

const TAMANOS = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-base gap-2 rounded-xl',
  icono: 'p-2 rounded-lg',
};

export function Button({
  children,
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  Icono,
  className = '',
  type = 'button',
  disabled,
  ...resto
}) {
  const clases = [
    'inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTES[variante] ?? VARIANTES.primario,
    TAMANOS[tamano] ?? TAMANOS.md,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={clases} disabled={disabled || cargando} {...resto}>
      {cargando ? (
        <Spinner tamanio={tamano === 'sm' ? 'xs' : 'sm'} />
      ) : (
        Icono && <Icono className={tamano === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
