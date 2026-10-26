/**
 * =============================================================================
 *  Generador de PIN de validación (token presencial de 4 dígitos)
 * =============================================================================
 *  El PIN se entrega al alumno al reservar y debe ser dictado en secretaría
 *  para retirar el equipo. Se usa crypto.randomInt (CSPRNG) en lugar de
 *  Math.random para que no sea predecible.
 * =============================================================================
 */

import { randomInt } from 'node:crypto';

/** Rango válido: 1000-9999 (siempre 4 dígitos, sin ceros "perdidos"). */
const MINIMO = 1000;
const MAXIMO = 9999;

/** Genera un PIN numérico aleatorio de 4 dígitos. */
export function generarPin() {
  return String(randomInt(MINIMO, MAXIMO + 1));
}

/** Valida el formato de un PIN recibido desde el cliente. */
export function esPinValido(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin.trim());
}
