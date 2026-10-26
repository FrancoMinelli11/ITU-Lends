/**
 * =============================================================================
 *  Esquemas de validación - Autenticación (Zod)
 * =============================================================================
 *  La validación vive en la capa de entrada (borde del sistema): ningún dato
 *  sin validar llega a los servicios ni a Prisma.
 * =============================================================================
 */

import { z } from 'zod';

// --- Reglas reutilizables ---------------------------------------------------
const dni = z
  .string({ required_error: 'El DNI es obligatorio.' })
  .trim()
  .regex(/^\d{7,8}$/, 'El DNI debe contener entre 7 y 8 dígitos numéricos.');

const nombrePropio = (campo) =>
  z
    .string({ required_error: `El ${campo} es obligatorio.` })
    .trim()
    .min(2, `El ${campo} debe tener al menos 2 caracteres.`)
    .max(60, `El ${campo} no puede superar los 60 caracteres.`)
    .regex(/^[\p{L}\s'.-]+$/u, `El ${campo} solo puede contener letras, espacios y guiones.`);

const email = z
  .string({ required_error: 'El correo electrónico es obligatorio.' })
  .trim()
  .toLowerCase()
  .email('Ingresá un correo electrónico válido.')
  .max(120, 'El correo no puede superar los 120 caracteres.');

// bcrypt trunca a 72 bytes: se limita el largo para evitar falsas expectativas.
const password = z
  .string({ required_error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

// --- Esquemas ---------------------------------------------------------------

/** POST /api/auth/registro (solo alumnos) */
export const esquemaRegistro = z.object({
  dni,
  nombre: nombrePropio('nombre'),
  apellido: nombrePropio('apellido'),
  email,
  password,
  confirmar_password: z.string().optional(),
});

/** POST /api/auth/login */
export const esquemaLogin = z.object({
  email,
  password: z.string({ required_error: 'La contraseña es obligatoria.' }).min(1, 'Ingresá tu contraseña.'),
});
