/**
 * =============================================================================
 *  Rate limiting
 * =============================================================================
 *  Protege los endpoints sensibles (login/registro) contra fuerza bruta y
 *  creación masiva de cuentas. En desarrollo los límites son más laxos para no
 *  entorpecer las pruebas manuales.
 * =============================================================================
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/** Respuesta uniforme con el contrato de errores de la API. */
const responderLimite = (_req, res) => {
  res.status(429).json({
    ok: false,
    error: {
      mensaje: 'Demasiados intentos. Esperá un momento antes de volver a intentar.',
      codigo: 'DEMASIADAS_SOLICITUDES',
    },
  });
};

const base = {
  standardHeaders: true, // Cabeceras RateLimit-*
  legacyHeaders: false,
  handler: responderLimite,
};

/** Login: frena ataques de diccionario sobre contraseñas. */
export const limitadorLogin = rateLimit({
  ...base,
  windowMs: 10 * 60 * 1000, // 10 minutos
  limit: env.esDesarrollo ? 50 : 10,
  skipSuccessfulRequests: true, // Solo cuentan los intentos fallidos
  message: 'Demasiados intentos de inicio de sesión.',
});

/** Registro: evita la creación automatizada de cuentas. */
export const limitadorRegistro = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: env.esDesarrollo ? 100 : 20,
});

/** Check-in por PIN: un PIN de 4 dígitos admite 10.000 combinaciones; el
 *  limitador hace inviable el escaneo por fuerza bruta desde la secretaría. */
export const limitadorCheckIn = rateLimit({
  ...base,
  windowMs: 5 * 60 * 1000,
  limit: env.esDesarrollo ? 200 : 60,
});
