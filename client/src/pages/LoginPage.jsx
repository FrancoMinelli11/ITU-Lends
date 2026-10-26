/**
 * Página de inicio de sesión.
 * Si ya hay sesión activa, redirige al panel correspondiente (evita volver al
 * formulario con el usuario ya logueado).
 */

import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRoundPlus, X } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout.jsx';
import { LoginForm } from '../components/auth/LoginForm.jsx';
import { Alert } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { RUTAS, rutaPorRol } from '../routes/rutas.js';

export function LoginPage() {
  const { autenticado, usuario, avisoSesion, limpiarAvisoSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  /** Destino solicitado antes de ser redirigido al login (si lo hubiera). */
  const destinoPendiente = ubicacion.state?.from?.pathname ?? null;

  useEffect(() => {
    if (!autenticado) return;
    navegar(destinoPendiente && destinoPendiente !== RUTAS.LOGIN ? destinoPendiente : rutaPorRol(usuario.rol), {
      replace: true,
    });
  }, [autenticado, usuario, destinoPendiente, navegar]);

  const alIngresar = (usuarioLogueado) => {
    navegar(
      destinoPendiente && destinoPendiente !== RUTAS.LOGIN
        ? destinoPendiente
        : rutaPorRol(usuarioLogueado.rol),
      { replace: true },
    );
  };

  return (
    <AuthLayout>
      {/* Aviso de sesión (por ejemplo, token vencido) */}
      {avisoSesion && (
        <div className="mb-4">
          <Alert variante="aviso">
            <div className="flex items-start justify-between gap-3">
              <span>{avisoSesion}</span>
              <button
                type="button"
                onClick={limpiarAvisoSesion}
                className="rounded p-0.5 transition hover:bg-amber-100"
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        </div>
      )}

      <div className="tarjeta p-6 sm:p-8">
        <LoginForm onIngreso={alIngresar} />

        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
          ¿Todavía no tenés cuenta?{' '}
          <Link
            to={RUTAS.REGISTRO}
            className="inline-flex items-center gap-1 font-medium text-marca-600 hover:text-marca-700"
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
            Registrate como alumno
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
