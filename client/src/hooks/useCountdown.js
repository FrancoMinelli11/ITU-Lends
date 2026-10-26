/**
 * =============================================================================
 *  useCountdown - Contador regresivo sincronizado con la hora del servidor
 * =============================================================================
 *  Recibe una fecha ISO (por ejemplo `liberacion_en` de una computadora) y
 *  devuelve los segundos restantes actualizados cada segundo.
 *
 *  Usa `utils/reloj.js` (corregido contra el servidor) en lugar de Date.now(),
 *  por lo que dos dispositivos con relojes distintos muestran el MISMO tiempo.
 *  El intervalo se limpia al desmontar o cuando cambia el objetivo.
 * =============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ahora } from '../utils/reloj.js';
import { formatearSegundos, formatearDuracion } from '../utils/format.js';

/**
 * @param {string|null} fechaISO Fecha objetivo (ISO 8601) o null.
 * @returns {{ segundos:number, texto:string, textoLargo:string, vencido:boolean, activo:boolean }}
 */
export function useCountdown(fechaISO) {
  const objetivo = useMemo(() => (fechaISO ? new Date(fechaISO).getTime() : null), [fechaISO]);

  const calcular = useCallback(() => {
    if (!objetivo) return 0;
    return Math.max(0, Math.round((objetivo - ahora()) / 1000));
  }, [objetivo]);

  const [segundos, setSegundos] = useState(calcular);

  useEffect(() => {
    // Sincroniza inmediatamente al cambiar el objetivo (no espera 1 s).
    setSegundos(calcular());

    if (!objetivo) return undefined;

    const temporizador = setInterval(() => setSegundos(calcular()), 1000);
    return () => clearInterval(temporizador);
  }, [objetivo, calcular]);

  return {
    segundos,
    texto: formatearSegundos(segundos),
    textoLargo: formatearDuracion(segundos),
    vencido: objetivo !== null && segundos <= 0,
    activo: objetivo !== null,
  };
}
