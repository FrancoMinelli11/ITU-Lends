/**
 * =============================================================================
 *  Fragmentos de consulta compartidos (data access)
 * =============================================================================
 *  Centralizan los `include`/`select` de Prisma que usan varios servicios, para
 *  que la forma de los datos sea idéntica sin importar desde dónde se consulte.
 * =============================================================================
 */

import { PRESTAMOS_VIGENTES } from '../config/constants.js';

/**
 * Trae el préstamo vigente (PENDIENTE_RETIRO o ACTIVO) de una computadora.
 * Como máximo puede haber uno a la vez: se ordena por inicio y se toma 1.
 */
export const INCLUIR_PRESTAMO_VIGENTE = {
  prestamos: {
    where: { estado: { in: PRESTAMOS_VIGENTES } },
    orderBy: { fecha_hora_inicio: 'asc' },
    take: 1,
    include: {
      usuario: { select: { id: true, nombre: true, apellido: true, dni: true } },
    },
  },
};

/** Datos públicos del usuario (nunca incluye `password`). */
export const SELECT_USUARIO_PUBLICO = {
  id: true,
  dni: true,
  nombre: true,
  apellido: true,
  email: true,
  rol: true,
  estado: true,
  creado_en: true,
};

/** Proyección de un reporte de falla embebido en un préstamo. */
export const SELECT_REPORTE = {
  id: true,
  descripcion: true,
  severidad: true,
  resuelto: true,
  estado: true,
  creado_en: true,
  usuario_id: true,
};

/** Relaciones que acompañan a un préstamo en las respuestas de la API. */
export const INCLUIR_DETALLE_PRESTAMO = {
  usuario: { select: SELECT_USUARIO_PUBLICO },
  computadora: {
    select: { id: true, codigo_inventario: true, modelo: true, estado: true },
  },
  // Fallas reportadas durante este préstamo (US-08): alimenta el panel de
  // secretaría y el modal de recepción sin una consulta extra.
  reportes: { select: SELECT_REPORTE, orderBy: { creado_en: 'desc' } },
};

/** Préstamos de una máquina para el historial de trazabilidad (secretaría). */
export const INCLUIR_PRESTAMO_HISTORIAL = {
  usuario: { select: SELECT_USUARIO_PUBLICO },
};
