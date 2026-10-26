/**
 * Visualización del PIN de retiro (4 dígitos) con acción de copiado.
 * El PIN es el "token de validación" que el alumno dicta en secretaría.
 */

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function PinDisplay({ pin, conCopiar = true, className = '' }) {
  const [copiado, setCopiado] = useState(false);
  const digitos = String(pin ?? '----').padStart(4, '0').split('');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(pin));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard bloqueado (contexto no seguro): el alumno puede leer el PIN igual.
      setCopiado(false);
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="flex gap-2">
        {digitos.map((digito, indice) => (
          <span
            key={indice}
            className="flex h-14 w-11 items-center justify-center rounded-xl bg-slate-900 font-mono text-2xl font-bold text-white shadow-sm sm:h-16 sm:w-14 sm:text-3xl"
          >
            {digito}
          </span>
        ))}
      </div>

      {conCopiar && (
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
        >
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'PIN copiado' : 'Copiar PIN'}
        </button>
      )}
    </div>
  );
}
