/**
 * =============================================================================
 *  Utilidades de contraseñas (bcrypt)
 * =============================================================================
 *  Se usa `bcryptjs`: implementación pura del algoritmo bcrypt, sin dependencias
 *  nativas (evita fallos de compilación en Windows/CI con distintas versiones
 *  de Node). Expone exactamente la misma API que el paquete `bcrypt`
 *  (hash / compare) y genera hashes compatibles entre ambos.
 * =============================================================================
 */

import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Genera el hash de una contraseña en texto plano.
 * @param {string} password
 * @returns {Promise<string>} hash bcrypt ($2a$10$...)
 */
export function hashearPassword(password) {
  return bcrypt.hash(password, env.saltRounds);
}

/**
 * Compara una contraseña en texto plano contra su hash almacenado.
 * bcryptjs es resistente a timing attacks por diseño.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export function verificarPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
