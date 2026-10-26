/**
 * =============================================================================
 *  Rutas de autenticación
 * =============================================================================
 *  Orden del pipeline: rate limit -> validación -> controlador.
 *  La validación se ejecuta ANTES del controlador: ningún dato inválido toca
 *  los servicios ni la base de datos.
 * =============================================================================
 */

import { Router } from 'express';
import { iniciarSesion, perfil, registrar } from '../controllers/auth.controller.js';
import { validar } from '../middlewares/validate.middleware.js';
import { autenticar } from '../middlewares/auth.middleware.js';
import { limitadorLogin, limitadorRegistro } from '../middlewares/rateLimit.middleware.js';
import { esquemaLogin, esquemaRegistro } from '../validators/auth.validator.js';

export const authRouter = Router();

/** POST /api/auth/registro -> crea la cuenta de un alumno. */
authRouter.post('/registro', limitadorRegistro, validar({ body: esquemaRegistro }), registrar);

/** POST /api/auth/login -> devuelve JWT (alumno o secretario). */
authRouter.post('/login', limitadorLogin, validar({ body: esquemaLogin }), iniciarSesion);

/** GET /api/auth/me -> perfil del usuario autenticado. */
authRouter.get('/me', autenticar, perfil);
