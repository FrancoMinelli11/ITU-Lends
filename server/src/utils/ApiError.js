/**
 * =============================================================================
 *  ApiError - Error de dominio con código HTTP asociado
 * =============================================================================
 *  Permite que los servicios expresen reglas de negocio con el status HTTP
 *  semántico correcto (400, 401, 403, 404, 409, ...) sin conocer Express.
 *  El error handler global se encarga de serializarlo.
 * =============================================================================
 */

export class ApiError extends Error {
  /**
   * @param {number} status   Código HTTP semántico.
   * @param {string} mensaje  Mensaje apto para mostrar al usuario final.
   * @param {object} [extra]  Detalles opcionales ({ codigo, detalles }).
   */
  constructor(status, mensaje, extra = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = extra.codigo ?? codigoPara(status);
    this.detalles = extra.detalles ?? null;
    this.esOperacional = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  // --- Azúcar sintáctico para los casos más usados -------------------------
  static badRequest(mensaje, detalles) {
    return new ApiError(400, mensaje, { codigo: 'SOLICITUD_INVALIDA', detalles });
  }

  static noAutorizado(mensaje = 'No autenticado. Iniciá sesión nuevamente.') {
    return new ApiError(401, mensaje, { codigo: 'NO_AUTENTICADO' });
  }

  static prohibido(mensaje = 'No tenés permisos para realizar esta acción.') {
    return new ApiError(403, mensaje, { codigo: 'SIN_PERMISOS' });
  }

  static noEncontrado(mensaje = 'El recurso solicitado no existe.') {
    return new ApiError(404, mensaje, { codigo: 'NO_ENCONTRADO' });
  }

  static conflicto(mensaje, detalles) {
    return new ApiError(409, mensaje, { codigo: 'CONFLICTO_DE_ESTADO', detalles });
  }

  static interno(mensaje = 'Ocurrió un error inesperado en el servidor.') {
    return new ApiError(500, mensaje, { codigo: 'ERROR_INTERNO' });
  }
}

/** Mapea status HTTP -> código de error legible por el frontend. */
function codigoPara(status) {
  const mapa = {
    400: 'SOLICITUD_INVALIDA',
    401: 'NO_AUTENTICADO',
    403: 'SIN_PERMISOS',
    404: 'NO_ENCONTRADO',
    409: 'CONFLICTO_DE_ESTADO',
    422: 'ENTIDAD_NO_PROCESABLE',
    429: 'DEMASIADAS_SOLICITUDES',
    500: 'ERROR_INTERNO',
  };
  return mapa[status] ?? 'ERROR_INTERNO';
}
