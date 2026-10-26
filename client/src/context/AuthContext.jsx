/**
 * =============================================================================
 *  AuthContext - Estado global de la sesión
 * =============================================================================
 *  Responsabilidades:
 *   - Mantener en memoria (y en localStorage) el token JWT y el usuario.
 *   - Exponer acciones de alto nivel: iniciarSesion, registrarAlumno, cerrarSesion.
 *   - Revalidar el token contra /auth/me al recargar la aplicación.
 *   - Cerrar la sesión automáticamente ante un 401 proveniente de cualquier
 *     request (el cliente Axios avisa a través de registrarManejadorNoAutorizado).
 *
 *  Ningún componente de la UI habla con la API de auth directamente: solo usan
 *  este contexto (desacople red/estado <-> vista).
 * =============================================================================
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  mensajeDeError,
  registrarManejadorNoAutorizado,
  sesionStorage,
} from '../api/axiosClient.js';
import { loginRequest, perfilRequest, registroRequest } from '../api/auth.api.js';
import { ROL } from '../constants/estados.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // El usuario se lee de localStorage para pintar la UI sin "parpadeo" mientras
  // se revalida el token contra el servidor.
  const [usuario, setUsuario] = useState(() => sesionStorage.leerUsuario());
  const [token, setToken] = useState(() => sesionStorage.leerToken());
  const [verificandoSesion, setVerificandoSesion] = useState(() => Boolean(sesionStorage.leerToken()));
  const [avisoSesion, setAvisoSesion] = useState(null);

  /** Limpia la sesión de memoria y almacenamiento. */
  const cerrarSesion = useCallback((aviso = null) => {
    sesionStorage.borrarToken();
    sesionStorage.borrarUsuario();
    setToken(null);
    setUsuario(null);
    if (aviso) setAvisoSesion(aviso);
  }, []);

  // --- Revalidación del token al montar ------------------------------------
  useEffect(() => {
    let cancelado = false;

    if (!token) {
      setVerificandoSesion(false);
      return undefined;
    }

    (async () => {
      try {
        const { usuario: usuarioFresco } = await perfilRequest();
        if (cancelado) return;
        setUsuario(usuarioFresco);
        sesionStorage.guardarUsuario(usuarioFresco);
      } catch (error) {
        if (cancelado) return;
        // Solo se cierra la sesión si el problema es de credenciales; ante una
        // caída de red se conserva el token para reintentar más adelante.
        if (error.status === 401 || error.status === 403) {
          cerrarSesion(mensajeDeError(error));
        }
      } finally {
        if (!cancelado) setVerificandoSesion(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [token, cerrarSesion]);

  // --- Logout automático ante cualquier 401 --------------------------------
  useEffect(() => {
    registrarManejadorNoAutorizado((error) => {
      cerrarSesion(error?.message ?? 'Tu sesión expiró. Volvé a iniciar sesión.');
    });
    return () => registrarManejadorNoAutorizado(null);
  }, [cerrarSesion]);

  /** Guarda la sesión devuelta por el backend. */
  const aplicarSesion = useCallback(({ usuario: usuarioNuevo, token: tokenNuevo }) => {
    sesionStorage.guardarToken(tokenNuevo);
    sesionStorage.guardarUsuario(usuarioNuevo);
    setToken(tokenNuevo);
    setUsuario(usuarioNuevo);
    setAvisoSesion(null);
    return usuarioNuevo;
  }, []);

  const iniciarSesion = useCallback(
    async (credenciales) => aplicarSesion(await loginRequest(credenciales)),
    [aplicarSesion],
  );

  const registrarAlumno = useCallback(
    async (datos) => aplicarSesion(await registroRequest(datos)),
    [aplicarSesion],
  );

  const valor = useMemo(
    () => ({
      usuario,
      token,
      autenticado: Boolean(token && usuario),
      esAlumno: usuario?.rol === ROL.ALUMNO,
      esSecretario: usuario?.rol === ROL.SECRETARIO,
      verificandoSesion,
      avisoSesion,
      limpiarAvisoSesion: () => setAvisoSesion(null),
      iniciarSesion,
      registrarAlumno,
      cerrarSesion,
    }),
    [
      usuario,
      token,
      verificandoSesion,
      avisoSesion,
      iniciarSesion,
      registrarAlumno,
      cerrarSesion,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto de sesión. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe utilizarse dentro de <AuthProvider>.');
  }
  return contexto;
}
