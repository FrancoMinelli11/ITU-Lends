/**
 * =============================================================================
 *  SocketContext - Canal de tiempo real
 * =============================================================================
 *  Responsabilidades:
 *   - Crear (y destruir) la conexión Socket.io cuando cambia la sesión.
 *   - Gestionar reconexiones automáticas y exponer el estado de la conexión.
 *   - Sincronizar el reloj con el servidor: cada evento trae `servidor_timestamp`
 *     y mediante el evento `sincronizar_hora` (con ack) se mide el RTT para
 *     corregir el desfase.
 *   - Limpiar TODOS los listeners al desmontar para evitar memory leaks.
 *
 *  Los componentes no consumen el socket directamente: usan el hook
 *  `useSocketEvent(evento, handler)`, que se suscribe y desuscribe solo.
 * =============================================================================
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { config } from '../config/env.js';
import { ESTADO_CONEXION, EVENTOS } from '../constants/eventos.js';
import { ajustarConServidor } from '../utils/reloj.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

/** Intervalo de resincronización del reloj (por si el equipo estuvo suspendido). */
const INTERVALO_RESINCRONIZACION_MS = 60_000;

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [estadoConexion, setEstadoConexion] = useState(ESTADO_CONEXION.DESCONECTADO);
  const [ultimoError, setUltimoError] = useState(null);

  // Referencia viva al socket para funciones expuestas en el contexto.
  const socketRef = useRef(null);

  /**
   * Handshake de reloj: mide el RTT y ajusta el desfase local lo mejor posible.
   * @param {import('socket.io-client').Socket} instancia
   */
  const sincronizarReloj = useCallback((instancia) => {
    if (!instancia?.connected) return;
    const inicio = Date.now();
    try {
      instancia.timeout(5000).emit(EVENTOS.SINCRONIZAR_HORA, (error, respuesta) => {
        if (error) return; // Timeout: se reintenta en el próximo ciclo.
        const rtt = Date.now() - inicio;
        ajustarConServidor(respuesta?.servidor_timestamp, rtt);
      });
    } catch {
      /* El socket se cerró entre la verificación y el emit. */
    }
  }, []);

  useEffect(() => {
    // Sin sesión no hay canal en tiempo real (no se conecta nadie anónimo).
    if (!token) {
      setSocket(null);
      socketRef.current = null;
      setEstadoConexion(ESTADO_CONEXION.DESCONECTADO);
      return undefined;
    }

    setEstadoConexion(ESTADO_CONEXION.CONECTANDO);

    const instancia = io(config.socketUrl, {
      // El backend verifica este token; si es inválido rechaza la conexión.
      auth: { token },
      transports: ['websocket', 'polling'],
      // --- Reconexión automática -----------------------------------------
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 10_000,
    });

    socketRef.current = instancia;
    setSocket(instancia);

    // --- Handlers ---------------------------------------------------------
    const alConectar = () => {
      setEstadoConexion(ESTADO_CONEXION.CONECTADO);
      setUltimoError(null);
      sincronizarReloj(instancia);
    };

    const alDesconectar = (motivo) => {
      // 'io client disconnect' = lo pedimos nosotros; el resto es caída de red.
      setEstadoConexion(
        motivo === 'io client disconnect' ? ESTADO_CONEXION.DESCONECTADO : ESTADO_CONEXION.RECONECTANDO,
      );
    };

    const alFallarConexion = (error) => {
      setUltimoError(error?.message ?? 'No se pudo conectar al canal en tiempo real.');
      // Si el token es inválido, no tiene sentido reintentar en bucle.
      setEstadoConexion(ESTADO_CONEXION.RECONECTANDO);
    };

    const alReintentar = () => setEstadoConexion(ESTADO_CONEXION.RECONECTANDO);

    instancia.on('connect', alConectar);
    instancia.on('disconnect', alDesconectar);
    instancia.on('connect_error', alFallarConexion);
    instancia.io.on('reconnect_attempt', alReintentar);

    // Cualquier trama con `servidor_timestamp` mantiene el reloj calibrado.
    instancia.onAny((_evento, payload) => {
      if (payload?.servidor_timestamp) ajustarConServidor(payload.servidor_timestamp);
    });

    // Resincronización periódica.
    const temporizador = setInterval(() => sincronizarReloj(instancia), INTERVALO_RESINCRONIZACION_MS);

    // --- Limpieza (evita memory leaks y conexiones huérfanas) -------------
    return () => {
      clearInterval(temporizador);
      instancia.removeAllListeners();
      instancia.io.removeAllListeners();
      instancia.disconnect();
      socketRef.current = null;
      setSocket(null);
      setEstadoConexion(ESTADO_CONEXION.DESCONECTADO);
    };
  }, [token, sincronizarReloj]);

  /** Vuelve a leer el inventario: usado por los botones de "Reintentar". */
  const forzarResincronizacion = useCallback(() => {
    const instancia = socketRef.current;
    if (!instancia) return;
    sincronizarReloj(instancia);
    if (!instancia.connected) instancia.connect();
  }, [sincronizarReloj]);

  const valor = useMemo(
    () => ({
      socket,
      estadoConexion,
      conectado: estadoConexion === ESTADO_CONEXION.CONECTADO,
      ultimoError,
      forzarResincronizacion,
    }),
    [socket, estadoConexion, ultimoError, forzarResincronizacion],
  );

  return <SocketContext.Provider value={valor}>{children}</SocketContext.Provider>;
}

/** Hook de acceso al contexto del socket. */
export function useSocket() {
  const contexto = useContext(SocketContext);
  if (!contexto) {
    throw new Error('useSocket debe utilizarse dentro de <SocketProvider>.');
  }
  return contexto;
}
