/**
 * Redirección de la raíz: envía a cada usuario a su panel según el rol.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { RUTAS, rutaPorRol } from './rutas.js';
import { CargandoBloque } from '../components/ui/Spinner.jsx';

export function RedireccionInicial() {
  const { autenticado, usuario, verificandoSesion } = useAuth();

  if (verificandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <CargandoBloque />
      </div>
    );
  }

  if (!autenticado) return <Navigate to={RUTAS.LOGIN} replace />;

  return <Navigate to={rutaPorRol(usuario.rol)} replace />;
}
