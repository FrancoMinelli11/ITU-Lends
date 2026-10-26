/**
 * =============================================================================
 *  Rutas de computadoras
 * =============================================================================
 *  Todo el catálogo requiere estar autenticado (alumno o secretario).
 * =============================================================================
 */

import { Router } from 'express';
import { cambiarEstado, estadisticas, historial, listar, listarAlumnos, obtener } from '../controllers/computadora.controller.js';
import { autenticar } from '../middlewares/auth.middleware.js';
import { soloSecretario } from '../middlewares/role.middleware.js';
import { validar } from '../middlewares/validate.middleware.js';
import {
  esquemaEstadoComputadora,
  esquemaFiltrosComputadoras,
  esquemaIdParam,
} from '../validators/prestamo.validator.js';

export const computadoraRouter = Router();

// Todas las rutas de este router exigen sesión válida.
computadoraRouter.use(autenticar);

/**
 * GET /api/computadoras?estado=DISPONIBLE&busqueda=pc-00
 * Devuelve el inventario con tiempos de liberación calculados.
 */
computadoraRouter.get('/', validar({ query: esquemaFiltrosComputadoras }), listar);

/** GET /api/computadoras/estadisticas/resumen -> contadores por estado. */
computadoraRouter.get('/estadisticas/resumen', soloSecretario, estadisticas);

/** GET /api/computadoras/alumnos/buscar?busqueda=... -> listado de alumnos. */
computadoraRouter.get('/alumnos/buscar', soloSecretario, listarAlumnos);

/** GET /api/computadoras/:id/historial -> trazabilidad de la máquina (Sprint 3). */
computadoraRouter.get('/:id/historial', soloSecretario, validar({ params: esquemaIdParam }), historial);

/** PATCH /api/computadoras/:id/estado -> sacar/reintegrar de MANTENIMIENTO (Sprint 3). */
computadoraRouter.patch('/:id/estado', soloSecretario, validar({ params: esquemaIdParam, body: esquemaEstadoComputadora }), cambiarEstado);

/** GET /api/computadoras/:id (declarada al final para no capturar rutas fijas). */
computadoraRouter.get('/:id', validar({ params: esquemaIdParam }), obtener);
