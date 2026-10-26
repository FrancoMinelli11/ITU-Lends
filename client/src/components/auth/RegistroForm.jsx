/**
 * =============================================================================
 *  RegistroForm - Alta de alumnos
 * =============================================================================
 *  Validación en dos capas:
 *   1. Cliente: feedback inmediato por campo (formato de DNI, email, fuerza de
 *      la contraseña y coincidencia de confirmación).
 *   2. Servidor: fuente de verdad (duplicados de DNI/email, reglas de formato).
 *      Los errores por campo que devuelve la API se pintan en el input que
 *      corresponde usando `mensajeDeCampo`.
 * =============================================================================
 */

import { useState } from 'react';
import { Eye, EyeOff, IdCard, KeyRound, Mail, UserRound, UserRoundPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { mensajeDeCampo, mensajeDeError } from '../../api/axiosClient.js';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';

const VALORES_INICIALES = {
  dni: '',
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  confirmar_password: '',
};

/** Validaciones locales (espejo de las del backend, para UX). */
function validarLocalmente(datos) {
  const errores = {};

  if (!/^\d{7,8}$/.test(datos.dni.trim())) {
    errores.dni = 'El DNI debe tener entre 7 y 8 dígitos numéricos.';
  }
  if (datos.nombre.trim().length < 2) errores.nombre = 'Ingresá tu nombre completo.';
  if (datos.apellido.trim().length < 2) errores.apellido = 'Ingresá tu apellido.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) {
    errores.email = 'Ingresá un correo electrónico válido.';
  }
  if (datos.password.length < 8) errores.password = 'La contraseña debe tener al menos 8 caracteres.';
  else if (!/[A-Za-z]/.test(datos.password) || !/\d/.test(datos.password)) {
    errores.password = 'La contraseña debe incluir al menos una letra y un número.';
  }
  if (datos.confirmar_password !== datos.password) {
    errores.confirmar_password = 'Las contraseñas no coinciden.';
  }

  return errores;
}

export function RegistroForm({ onRegistro }) {
  const { registrarAlumno } = useAuth();

  const [datos, setDatos] = useState(VALORES_INICIALES);
  const [verPassword, setVerPassword] = useState(false);
  const [erroresLocales, setErroresLocales] = useState({});
  const [errorServidor, setErrorServidor] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const actualizar = (campo) => (evento) => {
    setDatos((previo) => ({ ...previo, [campo]: evento.target.value }));
    // Limpia el error del campo al escribir (feedback inmediato).
    setErroresLocales((previo) => ({ ...previo, [campo]: undefined }));
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setErrorServidor(null);

    const errores = validarLocalmente(datos);
    setErroresLocales(errores);
    if (Object.keys(errores).length > 0) return;

    setEnviando(true);
    try {
      const usuario = await registrarAlumno({
        dni: datos.dni.trim(),
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        email: datos.email.trim().toLowerCase(),
        password: datos.password,
        confirmar_password: datos.confirmar_password,
      });
      onRegistro?.(usuario);
    } catch (fallo) {
      setErrorServidor(fallo);
    } finally {
      setEnviando(false);
    }
  };

  // Errores devueltos por el servidor, mapeados por campo.
  const errorServidorDe = (campo) => mensajeDeCampo(errorServidor, campo);

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Crear cuenta de alumno</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registrate para reservar computadoras del laboratorio.
        </p>
      </div>

      {errorServidor && (
        <Alert
          variante="error"
          titulo="No se pudo completar el registro"
          detalles={errorServidor.detalles?.filter((d) => !d.campo) }
        >
          {mensajeDeError(errorServidor)}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          etiqueta="DNI"
          Icono={IdCard}
          inputMode="numeric"
          placeholder="40111222"
          maxLength={8}
          value={datos.dni}
          onChange={(evento) =>
            setDatos((previo) => ({ ...previo, dni: evento.target.value.replace(/\D/g, '') }))
          }
          error={erroresLocales.dni ?? errorServidorDe('dni')}
          ayuda="7 u 8 dígitos, sin puntos"
          requerido
        />
        <Input
          etiqueta="Correo electrónico"
          type="email"
          Icono={Mail}
          placeholder="nombre@alumnos.edu.ar"
          autoComplete="email"
          value={datos.email}
          onChange={actualizar('email')}
          error={erroresLocales.email ?? errorServidorDe('email')}
          requerido
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          etiqueta="Nombre"
          Icono={UserRound}
          placeholder="Lucía"
          autoComplete="given-name"
          value={datos.nombre}
          onChange={actualizar('nombre')}
          error={erroresLocales.nombre}
          requerido
        />
        <Input
          etiqueta="Apellido"
          Icono={UserRound}
          placeholder="Fernández"
          autoComplete="family-name"
          value={datos.apellido}
          onChange={actualizar('apellido')}
          error={erroresLocales.apellido}
          requerido
        />
      </div>

      <div className="relative">
        <Input
          etiqueta="Contraseña"
          type={verPassword ? 'text' : 'password'}
          Icono={KeyRound}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          value={datos.password}
          onChange={actualizar('password')}
          error={erroresLocales.password}
          ayuda="Al menos una letra y un número"
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

      <Input
        etiqueta="Repetir contraseña"
        type={verPassword ? 'text' : 'password'}
        Icono={KeyRound}
        placeholder="••••••••"
        autoComplete="new-password"
        value={datos.confirmar_password}
        onChange={actualizar('confirmar_password')}
        error={erroresLocales.confirmar_password}
        requerido
      />

      <Button type="submit" tamano="lg" className="w-full" Icono={UserRoundPlus} cargando={enviando}>
        {enviando ? 'Creando cuenta...' : 'Registrarme'}
      </Button>

      <p className="text-center text-xs text-slate-500">
        Al registrarte aceptás las normas de uso del laboratorio de la facultad.
      </p>
    </form>
  );
}
