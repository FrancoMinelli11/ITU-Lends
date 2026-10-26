/**
 * =============================================================================
 *  useMisPrestamos - Préstamo vigente e historial del alumno
 * =============================================================================
 *  Mantiene sincronizado el préstamo propio cuando la secretaría hace el
 *  check-in, lo finaliza o cuando el sistema expira una reserva (todo por
 *  Socket.io), sin que el alumno tenga que recargar la página. El evento
 *  `prestamo_por_vencer` (Sprint 3) marca al vigente como avisado para que
 *  la alerta flotante pueda reactivarse desde el cliente.
 * =============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import { misPrestamosRequest } from '../api/prestamos.api.js';
import { mensajeDeError } from '../api/axiosClient.js';
import { EVENTOS } from '../constants/eventos.js';
import { ESTADOS_VIGENTES } from '../constants/estados.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocketEvent } from './useSocketEvent.js';

export function useMisPrestamos() {
  const { usuario } = useAuth();

  const [vigente, setVigente] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    setError(null);

    try {
      const { vigente: prestamoVigente, historial: prestamosAnteriores } = await misPrestamosRequest();
      setVigente(prestamoVigente);
      setHistorial(prestamosAnteriores);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** ¿El préstamo del evento pertenece al alumno logueado? */
  const esMio = useCallback((prestamo) => !usuario || prestamo?.usuario?.id === usuario.id, [usuario]);

  // --- Eventos en vivo ------------------------------------------------------
  useSocketEvent(EVENTOS.NUEVO_PRESTAMO, ({ prestamo } = {}) => {
    if (prestamo && esMio(prestamo)) setVigente(prestamo);
  });

  useSocketEvent(EVENTOS.PRESTAMO_ACTUALIZADO, ({ prestamo } = {}) => {
    if (!prestamo || !esMio(prestamo)) return;

    if (ESTADOS_VIGENTES.includes(prestamo.estado)) {
      // Check-in de la secretaría: el préstamo pasó a ACTIVO.
      setVigente(prestamo);
      return;
    }

    // Finalizado o cancelado: se libera el cupo y se refresca el historial.
    setVigente(null);
    void cargar({ silencioso: true });
  });

  useSocketEvent(EVENTOS.RESERVA_EXPIRADA, ({ prestamo } = {}) => {
    if (!prestamo || !esMio(prestamo)) return;
    setVigente(null);
    void cargar({ silencioso: true });
  });

  // Alerta preventiva del backend (15 min antes del cierre): se marca sobre el
  // préstamo vigente. No reemplaza el objeto completo para no perder campos ya
  // cargados (p. ej. la computadora completa del catálogo).
  useSocketEvent(EVENTOS.PRESTAMO_POR_VENCER, ({ prestamo } = {}) => {
    if (!prestamo || !esMio(prestamo)) return;
    setVigente((anterior) => {
      if (!anterior || anterior.id !== prestamo.id) return anterior;
      return { ...anterior, ...prestamo, vencimiento_avisado: true };
    });
  });

  return {
    vigente,
    historial,
    cargando,
    error,
    recargar: cargar,
    /** Permite que una acción local (reservar/cancelar) actualice el estado. */
    setVigente,
  };
}
