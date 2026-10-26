/**
 * Tarjetas de métricas del panel de secretaría.
 */

const COLORES = {
  marca: 'bg-marca-50 text-marca-700 ring-marca-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function TarjetaMetrica({ Icono, etiqueta, valor, color = 'marca', detalle }) {
  return (
    <div className="tarjeta flex items-center gap-3 p-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
          COLORES[color] ?? COLORES.marca
        }`}
      >
        {Icono && <Icono className="h-5 w-5" aria-hidden="true" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</p>
        <p className="text-2xl font-semibold leading-tight text-slate-900 cifras-fijas">{valor}</p>
        {detalle && <p className="truncate text-xs text-slate-400">{detalle}</p>}
      </div>
    </div>
  );
}
