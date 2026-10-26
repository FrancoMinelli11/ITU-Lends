/**
 * Modal accesible y reutilizable.
 *  - Cierra con la tecla ESC y con clic en el fondo.
 *  - Bloquea el scroll del body mientras está abierto.
 *  - Lleva el foco al panel al abrir y limpia los listeners al desmontar.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';

const ANCHOS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  children,
  ancho = 'md',
  cerrarConFondo = true,
  ocultarCerrar = false,
}) {
  const panelRef = useRef(null);

  // --- ESC + bloqueo del scroll ---------------------------------------------
  useEffect(() => {
    if (!abierta) return undefined;

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar?.();
    };

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alPresionarTecla);

    // Foco inicial dentro del diálogo (accesibilidad básica).
    const focoPrevio = document.activeElement;
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.style.overflow = overflowPrevio;
      // Devuelve el foco al elemento que abrió el modal.
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={cerrarConFondo ? () => onCerrar?.() : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
        className={`animate-fade-in w-full ${ANCHOS[ancho] ?? ANCHOS.md} max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white shadow-xl outline-none sm:rounded-2xl scroll-fino`}
      >
        {(titulo || !ocultarCerrar) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div>
              {titulo && <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>}
              {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
            </div>
            {!ocultarCerrar && (
              <Button variante="fantasma" tamano="icono" onClick={onCerrar} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
