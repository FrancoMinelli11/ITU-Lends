/**
 * =============================================================================
 *  Middleware de validación genérico (Zod)
 * =============================================================================
 *  Uso:  router.post('/', validar({ body: esquemaReservar }), controlador)
 *  - Reemplaza req.body/params/query por los datos YA parseados (con trim,
 *    lowerCase, coerciones aplicadas), de modo que las capas internas reciben
 *    datos confiables.
 *  - Responde 400 con el detalle de cada campo inválido.
 * =============================================================================
 */

import { ApiError } from '../utils/ApiError.js';

export function validar(esquemas = {}) {
  return (req, _res, next) => {
    const detalles = [];

    for (const parte of ['body', 'params', 'query']) {
      const esquema = esquemas[parte];
      if (!esquema) continue;

      const resultado = esquema.safeParse(req[parte] ?? {});

      if (!resultado.success) {
        detalles.push(
          ...resultado.error.issues.map((issue) => ({
            ubicacion: parte,
            campo: issue.path.length ? issue.path.join('.') : parte,
            mensaje: issue.message,
          })),
        );
        continue;
      }

      // `req.query` es un getter en Express 4: se redefine la propiedad en la
      // instancia para no depender del parseo original de la query string.
      if (parte === 'query') {
        Object.defineProperty(req, 'query', {
          value: resultado.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        req[parte] = resultado.data;
      }
    }

    if (detalles.length > 0) {
      return next(
        ApiError.badRequest('Los datos enviados no son válidos.', detalles),
      );
    }

    return next();
  };
}
