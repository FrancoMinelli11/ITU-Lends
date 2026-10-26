/**
 * Página 404.
 */

import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/Feedback.jsx';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg">
        <EmptyState
          Icono={Compass}
          titulo="Página no encontrada"
          descripcion="La dirección que abriste no existe o fue movida. Volvé al inicio para continuar."
          accion={
            <Link
              to="/"
              className="inline-flex items-center rounded-xl bg-marca-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-marca-700"
            >
              Ir al inicio
            </Link>
          }
        />
      </div>
    </div>
  );
}
