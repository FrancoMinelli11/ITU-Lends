/**
 * =============================================================================
 *  asyncHandler - Envoltorio para controladores asíncronos
 * =============================================================================
 *  Express 4 no captura los rechazos de promesas de los handlers async, por lo
 *  que un `await` que falle dejaría la request colgada. Este helper reenvía el
 *  error a `next()` para que lo procese el error handler global.
 * =============================================================================
 */

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
