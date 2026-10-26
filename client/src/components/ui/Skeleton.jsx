/**
 * Esqueletos de carga (skeletons) para el catálogo y las tablas.
 * Se usan en lugar de un spinner cuando conocemos la forma del contenido final:
 * la percepción de velocidad es mejor y se evita el salto de layout.
 */

export function SkeletonLinea({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/** Tarjeta fantasma equivalente a ComputadoraCard. */
export function SkeletonTarjeta() {
  return (
    <div className="tarjeta space-y-4 p-5">
      <div className="flex items-center justify-between">
        <SkeletonLinea className="h-4 w-20" />
        <SkeletonLinea className="h-6 w-24 rounded-full" />
      </div>
      <SkeletonLinea className="h-5 w-3/4" />
      <SkeletonLinea className="h-3 w-full" />
      <SkeletonLinea className="h-3 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <SkeletonLinea className="h-8 w-24" />
        <SkeletonLinea className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

/** Grilla de tarjetas fantasma. */
export function SkeletonGrilla({ cantidad = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cantidad }).map((_, indice) => (
        <SkeletonTarjeta key={indice} />
      ))}
    </div>
  );
}

/** Filas fantasma para tablas del panel de secretaría. */
export function SkeletonFilas({ cantidad = 4 }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: cantidad }).map((_, indice) => (
        <div key={indice} className="flex items-center gap-4">
          <SkeletonLinea className="h-10 w-10 rounded-full" />
          <SkeletonLinea className="h-4 flex-1" />
          <SkeletonLinea className="h-4 w-24" />
          <SkeletonLinea className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
