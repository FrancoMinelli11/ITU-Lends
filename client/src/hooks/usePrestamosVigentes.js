/**
 * =============================================================================
 *  usePrestamosVigentes - Cola de trabajo de la secretaría
 * =============================================================================
 *  Lista de reservas pendientes de retiro y préstamos activos. Se mantiene
 *  sincronizada con los eventos del servidor (nuevas reservas, check-in,
 *  finalizaciones y expiraciones).
 * =============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { prestamosVigentesRequest } from '../api/prestamos.api.js';
import { mensajeDeError } from '../api/axiosClient.js';
import { EVENTOS } from '../constants/eventos.js';
import { ESTADO_PRESTAMO, ESTADOS_VIGENTES } from '../constants/estados.js';
import { useSocketEvent } from './useSocketEvent.js';

/** Orden de atención: primero lo que vence antes (reservas por retirar y luego activos). */
const ordenar = (prestamos) =>
  [...prestamos].sort((a, b) => new Date(a.fecha_hora_fin_estimada) - new Date(b.fecha_hora_fin_estimada));

export function usePrestamosVigentes() {
  const [prestamos, setPrestamos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    setError(null);

    try {
      const { todos } = await prestamosVigentesRequest();
      setPrestamos(ordenar(todos));
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Inserta o actualiza un préstamo en la lista (patch local). */
  const fusionar = useCallback((prestamo) => {
    if (!prestamo) return;
    setPrestamos((previos) => {
      const indice = previos.findIndex((p) => p.id === prestamo.id);
      if (indice === -1) return ordenar([...previos, prestamo]);
      const copia = [...previos];
      copia[indice] = prestamo;
      return copia;
    });
  }, []);

  useSocketEvent(EVENTOS.NUEVO_PRESTAMO, ({ prestamo } = {}) => fusionar(prestamo));

  useSocketEvent(EVENTOS.PRESTAMO_ACTUALIZADO, ({ prestamo } = {}) => {
    if (!prestamo) return;
    // Si dejó de estar vigente (finalizado/cancelado) se quita de la cola.
    if (!ESTADOS_VIGENTES.includes(prestamo.estado)) {
      setPrestamos((previos) => previos.filter((p) => p.id !== prestamo.id));
      return;
    }
    fusionar(prestamo);
  });

  const { pendientes, activos } = useMemo(
    () => ({
      pendientes: prestamos.filter((p) => p.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO),
      activos: prestamos.filter((p) => p.estado === ESTADO_PRESTAMO.ACTIVO),
    }),
    [prestamos],
  );

  return {
    prestamos,
    pendientes,
    activos,
    cargando,
    error,
    recargar: cargar,
    fusionarPrestamo: fusionar,
    quitarPrestamo: useCallback((id) => setPrestamos((previos) => previos.filter((p) => p.id !== id)), []),
  };
}
