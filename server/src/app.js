/**
 * =============================================================================
 *  Aplicación Express
 * =============================================================================
 *  Solo configura el pipeline HTTP (seguridad, parsers, logs, rutas y manejo de
 *  errores). No contiene lógica de negocio ni acceso a datos.
 * =============================================================================
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { manejadorErrores, manejadorRutaNoEncontrada } from './middlewares/error.middleware.js';

export const app = express();

// --- Ajustes base ------------------------------------------------------------
app.disable('x-powered-by');
// Detrás de un proxy (nginx, Railway, etc.) permite que express-rate-limit lea
// la IP real del cliente desde X-Forwarded-For.
app.set('trust proxy', 1);

// --- Seguridad ---------------------------------------------------------------
app.use(
  helmet({
    // La API se consume desde otro origen (Vite en :5173), no sirve HTML propio.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Sin Origin: clientes nativos, curl o health checks de infraestructura.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);

      if (env.esDesarrollo) {
        console.warn(`[cors] Origen rechazado: ${origin}. Revisá CORS_ORIGIN en el .env`);
      }
      // No se lanza error: el navegador bloquea la respuesta por CORS.
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// --- Parsers (límite bajo: la API solo recibe JSON pequeño) ------------------
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// --- Logs de requests (solo en desarrollo) -----------------------------------
if (env.esDesarrollo) {
  app.use(morgan('dev'));
}

// --- Rutas -------------------------------------------------------------------
app.use('/api', apiRouter);

// --- Manejo de errores (siempre al final) ------------------------------------
app.use(manejadorRutaNoEncontrada);
app.use(manejadorErrores);
