/**
 * =============================================================================
 *  Controlador de autenticación
 * =============================================================================
 *  Responsabilidad única: traducir HTTP <-> servicio. Sin lógica de negocio,
 *  sin acceso a datos y sin try/catch (asyncHandler + error handler global).
 * =============================================================================
 */

import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { responderExito } from '../utils/respuesta.js';

/**
 * POST /api/auth/registro
 * Crea un alumno y devuelve el token para que quede logueado.
 */
export const registrar = asyncHandler(async (req, res) => {
  const resultado = await authService.registrarAlumno(req.body);
  return responderExito(res, resultado, 201);
});

/**
 * POST /api/auth/login
 * Sirve tanto para alumnos como para secretarios.
 */
export const iniciarSesion = asyncHandler(async (req, res) => {
  const resultado = await authService.iniciarSesion(req.body);
  return responderExito(res, resultado, 200);
});

/**
 * GET /api/auth/me
 * Devuelve el usuario del token actual (usado al recargar la SPA).
 */
export const perfil = asyncHandler(async (req, res) => {
  // req.usuario ya fue leído de la base por authMiddleware (datos frescos).
  return responderExito(res, { usuario: req.usuario }, 200);
});
