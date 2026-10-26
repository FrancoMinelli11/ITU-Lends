/**
 * =============================================================================
 *  Middleware de autorización por rol
 * =============================================================================
 *  Requiere que `autenticar` haya ejecutado antes.
 *  Uso:  router.post('/check-in', autenticar, requerirRol(ROL.SECRETARIO), ...)
 * =============================================================================
 */

import { ApiError } from '../utils/ApiError.js';
import { ROL } from '../config/constants.js';

const NOMBRES_ROL = {
  [ROL.ALUMNO]: 'alumno',
  [ROL.SECRETARIO]: 'secretario',
};

/**
 * @param {...string} rolesPermitidos
 */
export function requerirRol(...rolesPermitidos) {
  return (req, _res, next) => {
    if (!req.usuario) {
      return next(ApiError.noAutorizado());
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      const permitidos = rolesPermitidos.map((rol) => NOMBRES_ROL[rol] ?? rol).join(' o ');
      return next(
        ApiError.prohibido(`Esta acción es exclusiva para usuarios con rol ${permitidos}.`),
      );
    }

    return next();
  };
}

/** Atajos legibles para las rutas. */
export const soloAlumno = requerirRol(ROL.ALUMNO);
export const soloSecretario = requerirRol(ROL.SECRETARIO);
export const cualquierRol = requerirRol(ROL.ALUMNO, ROL.SECRETARIO);
