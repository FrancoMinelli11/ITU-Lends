/**
 * Página de registro de alumnos.
 * Tras un registro exitoso el usuario queda autenticado y se lo envía al panel.
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AuthLayout } from '../components/auth/AuthLayout.jsx';
import { RegistroForm } from '../components/auth/RegistroForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { RUTAS, rutaPorRol } from '../routes/rutas.js';

export function RegistroPage() {
  const { autenticado, usuario } = useAuth();
  const navegar = useNavigate();

  useEffect(() => {
    if (autenticado) navegar(rutaPorRol(usuario.rol), { replace: true });
  }, [autenticado, usuario, navegar]);

  const alRegistrar = (usuarioNuevo) => navegar(rutaPorRol(usuarioNuevo.rol), { replace: true });

  return (
    <AuthLayout>
      <div className="tarjeta p-6 sm:p-8">
        <RegistroForm onRegistro={alRegistrar} />

        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">
          ¿Ya tenés cuenta?{' '}
          <Link
            to={RUTAS.LOGIN}
            className="inline-flex items-center gap-1 font-medium text-marca-600 hover:text-marca-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
