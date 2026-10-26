/**
 * =============================================================================
 *  LoginForm - Formulario de inicio de sesión
 * =============================================================================
 *  Componente de una sola responsabilidad: capturar credenciales, mostrar el
 *  estado de la operación y delegar el login al AuthContext.
 *  El AuthContext es quien entrega el usuario (con su rol) para redirigir.
 * =============================================================================
 */

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { esDesarrollo } from '../../config/env.js';
import { mensajeDeError } from '../../api/axiosClient.js';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';

export function LoginForm({ onIngreso }) {
  const { iniciarSesion } = useAuth();

  const [credenciales, setCredenciales] = useState({ email: '', password: '' });
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const actualizar = (campo) => (evento) =>
    setCredenciales((previo) => ({ ...previo, [campo]: evento.target.value }));

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (!credenciales.email.trim() || !credenciales.password) {
      setError('Ingresá tu correo electrónico y tu contraseña.');
      return;
    }

    setEnviando(true);
    try {
      const usuario = await iniciarSesion({
        email: credenciales.email.trim(),
        password: credenciales.password,
      });
      onIngreso?.(usuario);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ingresá con tu cuenta de alumno o de secretaría.
        </p>
      </div>

      {error && <Alert variante="error">{error}</Alert>}

      <Input
        etiqueta="Correo electrónico"
        type="email"
        Icono={Mail}
        autoComplete="email"
        placeholder="nombre@alumnos.edu.ar"
        value={credenciales.email}
        onChange={actualizar('email')}
        requerido
      />

      <div className="relative">
        <Input
          etiqueta="Contraseña"
          type={verPassword ? 'text' : 'password'}
          Icono={KeyRound}
          autoComplete="current-password"
          placeholder="••••••••"
          value={credenciales.password}
          onChange={actualizar('password')}
          requerido
        />
        <button
          type="button"
          onClick={() => setVerPassword((previo) => !previo)}
          className="absolute right-3 top-[34px] rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <Button type="submit" tamano="lg" className="w-full" Icono={LogIn} cargando={enviando}>
        {enviando ? 'Verificando...' : 'Ingresar'}
      </Button>

      {/* Credenciales de prueba: solo visibles en desarrollo para no exponerlas. */}
      {esDesarrollo && (
        <Alert variante="info" titulo="Cuentas de prueba (seed)">
          <ul className="space-y-1 font-mono text-xs">
            <li>• secretaria@facultad.edu.ar · Secretario123!</li>
            <li>• camila.duarte@alumnos.edu.ar · Alumno123!</li>
          </ul>
        </Alert>
      )}
    </form>
  );
}
