/**
 * =============================================================================
 *  Contrato de respuesta HTTP
 * =============================================================================
 *  Todas las respuestas exitosas de la API comparten la misma forma:
 *
 *      { ok: true, data: <payload>, meta: { servidor_timestamp } }
 *
 *  `servidor_timestamp` es la hora del servidor en milisegundos. El frontend la
 *  usa para corregir el desfase de reloj y que los contadores regresivos sean
 *  exactos en cualquier dispositivo, sin importar cómo esté su reloj local.
 * =============================================================================
 */

/** Respuesta exitosa con el envoltorio estándar. */
export function responderExito(res, data, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    meta: { servidor_timestamp: Date.now() },
  });
}
