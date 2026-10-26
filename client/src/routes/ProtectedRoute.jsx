/**
 * =============================================================================
 *  ProtectedRoute - Guardia de rutas por sesión y por rol
 * =============================================================================
 *  Casos que cubre:
 *   1. Sesión en verificación (token guardado, /auth/me en curso) -> splash.
 *   2. Sin sesión -> redirige a /login recordando el destino original.
 *   3. Sesión válida pero rol no autorizado -> redirige a SU panel.
 *
 *  La autorización real de cada operación siempre ocurre en el backend: esto es
 *  solo navegación y experiencia de usuario.
 * =============================================================================
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { CargandoBloque } from '../components/ui/Spinner.jsx';
import { RUTAS, rutaPorRol } from './rutas.js';

export function ProtectedRoute({ roles }) {
  const { autenticado, usuario, verificandoSesion } = useAuth();
  const ubicacion = useLocation();

  // 1) Revalidando el token guardado: pantalla de espera.
  if (verificandoSesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <CargandoBloque mensaje="Verificando tu sesión..." />
      </div>
    );
  }

  // 2) Sin sesión: se guarda el destino para volver después del login.
  if (!autenticado) {
    return <Navigate to={RUTAS.LOGIN} replace state={{ from: ubicacion }} />;
  }

  // 3) Rol no autorizado para esta sección.
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={rutaPorRol(usuario.rol)} replace />;
  }

  return <Outlet />;
}
