/**
 * =============================================================================
 *  useComputadoras - Catálogo de computadoras con actualizaciones en vivo
 * =============================================================================
 *  Encapsula: carga inicial, estados de UI (cargando / error / vacío),
 *  recarga manual y sincronización en tiempo real a través de Socket.io.
 *
 *  Cuando llega `computadora_actualizada` se reemplaza SOLO esa máquina en el
 *  estado local (patch optimista), sin volver a pedir todo el catálogo: la UI se
 *  actualiza al instante y con un costo de red mínimo.
 * =============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarComputadorasRequest } from '../api/computadoras.api.js';
import { mensajeDeError } from '../api/axiosClient.js';
import { EVENTOS } from '../constants/eventos.js';
import { ESTADO_COMPUTADORA } from '../constants/estados.js';
import { useSocketEvent } from './useSocketEvent.js';

/** Orden estable por código de inventario (CX-01, CX-02, ...). */
const ordenar = (computadoras) =>
  [...computadoras].sort((a, b) =>
    String(a.codigo_inventario).localeCompare(String(b.codigo_inventario), 'es', { numeric: true }),
  );

export function useComputadoras() {
  const [computadoras, setComputadoras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargando(true);
    setError(null);

    try {
      const { computadoras: recibidas } = await listarComputadorasRequest();
      setComputadoras(ordenar(recibidas));
      setUltimaActualizacion(Date.now());
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // --- Sincronización en tiempo real ---------------------------------------
  useSocketEvent(EVENTOS.COMPUTADORA_ACTUALIZADA, ({ computadora } = {}) => {
    if (!computadora) return;

    setComputadoras((previas) => {
      const indice = previas.findIndex((pc) => pc.id === computadora.id);
      // Máquina nueva para este cliente: se inserta respetando el orden.
      if (indice === -1) return ordenar([...previas, computadora]);

      const copia = [...previas];
      copia[indice] = computadora;
      return copia;
    });

    setUltimaActualizacion(Date.now());
  });

  // Una reserva expirada también libera una máquina: el backend ya emitió
  // `computadora_actualizada`; acá solo se refresca por si se perdió el evento.
  useSocketEvent(EVENTOS.RESERVA_EXPIRADA, () => {
    void cargar({ silencioso: true });
  });

  /** Contadores por estado calculados en el cliente (siempre coherentes con la lista). */
  const resumen = useMemo(() => {
    const base = {
      total: computadoras.length,
      [ESTADO_COMPUTADORA.DISPONIBLE]: 0,
      [ESTADO_COMPUTADORA.RESERVADA]: 0,
      [ESTADO_COMPUTADORA.EN_USO]: 0,
      [ESTADO_COMPUTADORA.MANTENIMIENTO]: 0,
    };
    for (const pc of computadoras) {
      base[pc.estado] = (base[pc.estado] ?? 0) + 1;
    }
    return base;
  }, [computadoras]);

  return {
    computadoras,
    resumen,
    cargando,
    error,
    ultimaActualizacion,
    recargar: cargar,
    /** Reemplazo local tras una operación propia (feedback inmediato). */
    fusionarComputadora: useCallback((computadora) => {
      if (!computadora) return;
      setComputadoras((previas) => {
        const indice = previas.findIndex((pc) => pc.id === computadora.id);
        if (indice === -1) return ordenar([...previas, computadora]);
        const copia = [...previas];
        copia[indice] = computadora;
        return copia;
      });
    }, []),
  };
}
