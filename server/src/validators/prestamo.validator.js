/**
 * =============================================================================
 *  Esquemas de validación - Préstamos y computadoras (Zod)
 * =============================================================================
 */

import { z } from 'zod';

/** Identificador UUID recibido por parámetro de ruta. */
export const esquemaIdParam = z.object({
  id: z.string({ required_error: 'Falta el identificador.' }).uuid('El identificador no es un UUID válido.'),
});

/**
 * POST /api/prestamos/reservar
 * `inicio_programado` es opcional:
 *  - ausente            -> reserva inmediata (se toma la hora del servidor).
 *  - fecha ISO 8601     -> reserva programada (máximo +60 min, validado en el servicio).
 */
export const esquemaReservar = z.object({
  computadora_id: z
    .string({ required_error: 'Tenés que indicar la computadora a reservar.' })
    .uuid('El identificador de la computadora no es válido.'),
  inicio_programado: z
    .string()
    .datetime({ offset: true, message: 'La fecha de inicio debe estar en formato ISO 8601.' })
    .optional()
    .nullable(),
});

/** POST /api/prestamos/check-in (secretaría) */
export const esquemaCheckIn = z.object({
  token: z
    .string({ required_error: 'Ingresá el PIN de 4 dígitos del alumno.' })
    .trim()
    .regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 dígitos numéricos.'),
});

/** POST /api/prestamos/:id/finalizar */
export const esquemaFinalizar = z.object({
  observaciones: z.string().trim().max(300, 'Las observaciones no pueden superar los 300 caracteres.').optional(),
});

/** Severidades admitidas en un reporte de falla (US-08). */
const severidadZod = z.enum(['LEVE', 'GRAVE', 'CRITICA'], {
  errorMap: () => ({ message: 'La severidad debe ser LEVE, GRAVE o CRITICA.' }),
});

/**
 * POST /api/prestamos/:id/devolver  (US-06 + US-08)
 * Devolución con feedback: observaciones opcionales del entregador y, si hubo
 * problemas técnicos, un reporte de falla con severidad y descripción.
 */
export const esquemaDevolver = z.object({
  observaciones: z
    .string({ invalid_type_error: 'Las observaciones deben ser texto.' })
    .trim()
    .max(300, 'Las observaciones no pueden superar los 300 caracteres.')
    .optional()
    .nullable(),
  reporte: z
    .object({
      severidad: severidadZod,
      descripcion: z
        .string({ required_error: 'Describí la falla detectada.' })
        .trim()
        .min(10, 'Describí la falla con al menos 10 caracteres.')
        .max(500, 'La descripción no puede superar los 500 caracteres.'),
    })
    .optional()
    .nullable(),
});

/** PATCH /api/computadoras/:id/estado  (secretaría: mantenimiento manual) */
export const esquemaEstadoComputadora = z.object({
  estado: z.enum(['MANTENIMIENTO', 'DISPONIBLE'], {
    errorMap: () => ({ message: 'El estado debe ser MANTENIMIENTO o DISPONIBLE.' }),
  }),
  motivo: z.string().trim().max(200, 'El motivo no puede superar los 200 caracteres.').optional().nullable(),
});

/** GET /api/computadoras?estado=DISPONIBLE&busqueda=pc-00 */
export const esquemaFiltrosComputadoras = z.object({
  // Se normaliza con trim ANTES de validar contra el enum, para tolerar
  // parámetros de URL con espacios accidentales (?estado=DISPONIBLE%20).
  estado: z
    .string()
    .trim()
    .pipe(
      z.enum(['DISPONIBLE', 'RESERVADA', 'EN_USO', 'MANTENIMIENTO'], {
        errorMap: () => ({ message: 'El estado indicado no es válido.' }),
      }),
    )
    .optional(),
  busqueda: z.string().trim().max(60, 'La búsqueda no puede superar los 60 caracteres.').optional(),
});
