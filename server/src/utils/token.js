/**
 * =============================================================================
 *  Servicio de tokens JWT
 * =============================================================================
 *  Centraliza la firma y verificación para que el middleware, los servicios y
 *  el socket compartan exactamente la misma política (algoritmo, expiración,
 *  forma del payload).
 * =============================================================================
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';

/** Algoritmo explícito: evita ataques de confusión de algoritmos (alg=none). */
const ALGORITMO = 'HS256';
const EMISOR = 'prestamos-itu';
const AUDIENCIA = 'prestamos-itu-client';

/**
 * Firma un token con el contexto mínimo necesario (id y rol).
 * @param {{ id: string, rol: string, dni?: string }} usuario
 * @returns {string}
 */
export function firmarToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      rol: usuario.rol,
      // Dato no sensible útil para logs/auditoría sin consultar la BD.
      dni: usuario.dni,
    },
    env.jwt.secreto,
    {
      algorithm: ALGORITMO,
      expiresIn: env.jwt.expiraEn,
      issuer: EMISOR,
      audience: AUDIENCIA,
    },
  );
}

/**
 * Verifica un token y retorna el payload.
 * @param {string} token
 * @returns {{ sub: string, rol: string, dni?: string, iat: number, exp: number }}
 * @throws {ApiError} 401 si el token es inválido o expiró.
 */
export function verificarToken(token) {
  try {
    return jwt.verify(token, env.jwt.secreto, {
      algorithms: [ALGORITMO], // Solo se aceptan tokens firmados con HS256
      issuer: EMISOR,
      audience: AUDIENCIA,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.noAutorizado('Tu sesión expiró. Volvé a iniciar sesión.');
    }
    throw ApiError.noAutorizado('Token inválido o manipulado.');
  }
}

/** Extrae el token del header Authorization: Bearer <token>. */
export function extraerBearer(headerAutorizacion = '') {
  if (typeof headerAutorizacion !== 'string') return null;
  const [tipo, token] = headerAutorizacion.split(' ');
  if (!token || tipo?.toLowerCase() !== 'bearer') return null;
  return token.trim();
}
