/**
 * =============================================================================
 *  useAsyncAction - Estado de una operación asincrónica (POST/PUT/DELETE)
 * =============================================================================
 *  Evita repetir en cada vista el trío `enProceso / error / exito` y el manejo
 *  del try/catch. Devuelve `ejecutar` sin lanzar excepciones: la UI consume
 *  `errorMensaje` para pintar el feedback.
 * =============================================================================
 */

import { useCallback, useState } from 'react';
import { mensajeDeError } from '../api/axiosClient.js';

/**
 * @param {Function} accion Función asincrónica a ejecutar.
 */
export function useAsyncAction(accion) {
  const [enProceso, setEnProceso] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const ejecutar = useCallback(
    async (...argumentos) => {
      setEnProceso(true);
      setError(null);

      try {
        const respuesta = await accion(...argumentos);
        setResultado(respuesta ?? true);
        return respuesta;
      } catch (fallo) {
        setError(fallo);
        return undefined;
      } finally {
        setEnProceso(false);
      }
    },
    [accion],
  );

  const reiniciar = useCallback(() => {
    setError(null);
    setResultado(null);
  }, []);

  return {
    ejecutar,
    enProceso,
    error,
    errorMensaje: mensajeDeError(error),
    detallesError: Array.isArray(error?.detalles) ? error.detalles : [],
    resultado,
    exito: Boolean(resultado) && !error,
    reiniciar,
  };
}
