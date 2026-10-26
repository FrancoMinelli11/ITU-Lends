/**
 * =============================================================================
 *  Router raíz de la API
 * =============================================================================
 *  Monta los sub-routers y expone endpoints de infraestructura.
 * =============================================================================
 */

import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { computadoraRouter } from './computadora.routes.js';
import { prestamoRouter } from './prestamo.routes.js';
import { autenticar } from '../middlewares/auth.middleware.js';
import { responderExito } from '../utils/respuesta.js';

export const apiRouter = Router();

/**
 * GET /api/health
 * Health check público para verificar que la API responde.
 */
apiRouter.get('/health', (_req, res) =>
  responderExito(res, { estado: 'ok', servicio: 'prestamos-itu-api', entorno: process.env.NODE_ENV ?? 'development' }, 200),
);

/**
 * GET /api/servidor/hora
 * Reloj autoritativo. El frontend calcula el offset contra su propio reloj
 * (aplicando la mitad del RTT) para que los contadores regresivos coincidan
 * entre dispositivos. Requiere sesión para no exponer superficie innecesaria.
 */
apiRouter.get('/servidor/hora', autenticar, (_req, res) => responderExito(res, { servidor_timestamp: Date.now() }, 200));

// --- Recursos ----------------------------------------------------------------
apiRouter.use('/auth', authRouter);
apiRouter.use('/computadoras', computadoraRouter);
apiRouter.use('/prestamos', prestamoRouter);
