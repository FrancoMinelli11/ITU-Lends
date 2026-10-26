/**
 * =============================================================================
 *  useSocketEvent - Suscripción declarativa a eventos de Socket.io
 * =============================================================================
 *  Encapsula el patrón on/off con limpieza automática:
 *
 *      useSocketEvent(EVENTOS.COMPUTADORA_ACTUALIZADA, ({ computadora }) => {...});
 *
 *  El handler se guarda en un ref, por lo que puede ser una función en línea sin
 *  provocar resuscribciones en cada render (evita el clásico bug de listeners
 *  duplicados). Al desmontar el componente SIEMPRE se ejecuta el cleanup, lo que
 *  previene memory leaks y actualizaciones de estado sobre componentes muertos.
 * =============================================================================
 */

import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

/**
 * @param {string} evento     Nombre del evento (ver constants/eventos.js).
 * @param {Function} manejador Callback con el payload del servidor.
 */
export function useSocketEvent(evento, manejador) {
  const { socket } = useSocket();

  const manejadorRef = useRef(manejador);

  // Mantiene la referencia actualizada sin resuscribcir.
  useEffect(() => {
    manejadorRef.current = manejador;
  }, [manejador]);

  useEffect(() => {
    if (!socket) return undefined;

    const listener = (...argumentos) => manejadorRef.current?.(...argumentos);

    socket.on(evento, listener);

    // Cleanup: se quita exactamente el mismo listener registrado.
    return () => {
      socket.off(evento, listener);
    };
  }, [socket, evento]);
}
