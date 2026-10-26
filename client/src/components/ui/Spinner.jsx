/**
 * Spinner de carga reutilizable (feedback visual en botones y secciones).
 */

const TAMANOS = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

export function Spinner({ tamanio = 'md', className = '', etiqueta }) {
  return (
    <span
      role="status"
      aria-label={etiqueta ?? 'Cargando'}
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${TAMANOS[tamanio] ?? TAMANOS.md} ${className}`}
    >
      <span className="sr-only">{etiqueta ?? 'Cargando...'}</span>
    </span>
  );
}

/** Bloque de carga centrado para pantallas completas o secciones grandes. */
export function CargandoBloque({ mensaje = 'Cargando información...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner tamanio="lg" className="text-marca-600" />
      <p className="text-sm">{mensaje}</p>
    </div>
  );
}
