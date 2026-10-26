/**
 * Campo de texto con etiqueta, ayuda y mensaje de error accesibles.
 * Usa `forwardRef` para que pueda integrarse con librerías de formularios.
 */

import { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input(
  { etiqueta, error, ayuda, Icono, className = '', contenedorClassName = '', requerido = false, ...resto },
  ref,
) {
  const idGenerado = useId();
  const id = resto.id ?? idGenerado;
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  const clasesInput = [
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400',
    'focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
    error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30' : 'border-slate-300',
    Icono ? 'pl-10' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={contenedorClassName}>
      {etiqueta && (
        <label htmlFor={id} className="etiqueta">
          {etiqueta}
          {requerido && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}

      <div className="relative">
        {Icono && (
          <Icono
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          ref={ref}
          className={clasesInput}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          {...resto}
        />
      </div>

      {error ? (
        <p id={idError} className="texto-error" role="alert">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={idAyuda} className="texto-ayuda">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
});
