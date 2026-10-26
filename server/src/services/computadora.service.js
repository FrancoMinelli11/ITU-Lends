/**
 * =============================================================================
 *  Servicio de computadoras (catálogo)
 * =============================================================================
 *  Expone el inventario con la información de disponibilidad ya calculada:
 *  cada equipo ocupado o reservado incluye cuánto falta para que se libere,
 *  de modo que el frontend no tenga que inferir reglas de negocio.
 * =============================================================================
 */

import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { serializarComputadora, serializarPrestamo, serializarReporteFalla } from '../utils/serializers.js';
import { ESTADO_COMPUTADORA, ESTADO_REPORTE } from '../config/constants.js';
import {
  INCLUIR_PRESTAMO_HISTORIAL,
  INCLUIR_PRESTAMO_VIGENTE,
  SELECT_USUARIO_PUBLICO,
} from '../data/includes.js';
import * as realtime from '../realtime/socket.js';

/** Opciones de las transacciones: tolera esperas de bloqueo razonables. */
const OPCIONES_TRANSACCION = { maxWait: 5000, timeout: 15000 };

/**
 * Lista el inventario completo (o filtrado) con tiempos de liberación.
 * @param {{ estado?: string, busqueda?: string }} filtros
 * @returns {Promise<object[]>} computadoras serializadas
 */
export async function listarComputadoras(filtros = {}) {
  const { estado, busqueda } = filtros;

  const computadoras = await prisma.computadora.findMany({
    where: {
      ...(estado ? { estado } : {}),
      ...(busqueda
        ? {
            OR: [
              { codigo_inventario: { contains: busqueda, mode: 'insensitive' } },
              { modelo: { contains: busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: INCLUIR_PRESTAMO_VIGENTE,
    // Orden natural por código de inventario (CX-01, CX-02, ...).
    orderBy: { codigo_inventario: 'asc' },
  });

  // Un único `ahora` para todas las filas -> contadores consistentes entre sí.
  const ahora = new Date();
  return computadoras.map((computadora) => serializarComputadora(computadora, ahora));
}

/**
 * Obtiene una computadora puntual.
 * @param {string} id
 */
export async function obtenerComputadora(id) {
  const computadora = await prisma.computadora.findUnique({
    where: { id },
    include: INCLUIR_PRESTAMO_VIGENTE,
  });

  if (!computadora) {
    throw ApiError.noEncontrado('La computadora indicada no existe.');
  }

  return serializarComputadora(computadora);
}

/**
 * Resumen del inventario para las tarjetas del panel de secretaría.
 * Se calcula con groupBy (una sola consulta) en lugar de traer todas las filas.
 */
export async function obtenerEstadisticas() {
  const agrupado = await prisma.computadora.groupBy({
    by: ['estado'],
    _count: { _all: true },
  });

  const conteo = Object.values(ESTADO_COMPUTADORA).reduce((acc, estado) => {
    acc[estado] = 0;
    return acc;
  }, {});

  for (const fila of agrupado) {
    conteo[fila.estado] = fila._count._all;
  }

  const total = Object.values(conteo).reduce((suma, valor) => suma + valor, 0);

  return {
    total,
    disponibles: conteo[ESTADO_COMPUTADORA.DISPONIBLE],
    reservadas: conteo[ESTADO_COMPUTADORA.RESERVADA],
    en_uso: conteo[ESTADO_COMPUTADORA.EN_USO],
    en_mantenimiento: conteo[ESTADO_COMPUTADORA.MANTENIMIENTO],
  };
}

/**
 * Lista simple de alumnos activos (útil para el panel de secretaría al
 * gestionar un préstamo presencial).
 */
export async function listarAlumnos({ busqueda } = {}) {
  const alumnos = await prisma.usuario.findMany({
    where: {
      rol: 'ALUMNO',
      ...(busqueda
        ? {
            OR: [
              { dni: { contains: busqueda } },
              { nombre: { contains: busqueda, mode: 'insensitive' } },
              { apellido: { contains: busqueda, mode: 'insensitive' } },
              { email: { contains: busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: SELECT_USUARIO_PUBLICO,
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    take: 50,
  });

  return alumnos;
}

// -----------------------------------------------------------------------------
//  Sprint 3: trazabilidad y mantenimiento (secretaría)
// -----------------------------------------------------------------------------

/**
 * Historial de una máquina: préstamos cronológicos (con el alumno que la usó)
 * y todas las fallas reportadas. Es la base del panel de trazabilidad.
 * @param {string} id Id de la computadora.
 * @returns {Promise<{ computadora: object, prestamos: object[], reportes: object[] }>}
 */
export async function obtenerHistorialComputadora(id) {
  const computadora = await prisma.computadora.findUnique({
    where: { id },
    select: {
      id: true,
      codigo_inventario: true,
      modelo: true,
      especificaciones: true,
      estado: true,
      actualizado_en: true,
    },
  });

  if (!computadora) throw ApiError.noEncontrado('La computadora indicada no existe.');

  const [prestamos, reportes] = await Promise.all([
    prisma.prestamo.findMany({
      where: { computadora_id: id },
      // Más recientes primero: es lo que consulta secretaría al rastrear una falla.
      orderBy: { fecha_hora_inicio: 'desc' },
      take: 50,
      include: INCLUIR_PRESTAMO_HISTORIAL,
    }),
    prisma.reporteFalla.findMany({
      where: { computadora_id: id },
      orderBy: { creado_en: 'desc' },
      include: { usuario: { select: { nombre: true, apellido: true, dni: true } } },
    }),
  ]);

  const ahora = new Date();
  return {
    computadora,
    prestamos: prestamos.map((prestamo) => serializarPrestamo(prestamo, { ahora })),
    reportes: reportes.map((reporte) => serializarReporteFalla(reporte)),
  };
}

/**
 * Cambio manual de estado de una máquina (secretaría):
 *   - DISPONIBLE    -> MANTENIMIENTO: saca el equipo de servicio (solo si está
 *     libre; si está reservado o en uso hay que cerrar el préstamo antes).
 *   - MANTENIMIENTO -> DISPONIBLE: reintegra el equipo y cierra sus reportes
 *     abiertos (la reparación se da por hecha).
 * @param {{ computadoraId: string, estado: string, motivo?: string|null }} params
 * @returns {Promise<{ computadora: object }>}
 */
export async function cambiarEstado({ computadoraId, estado, motivo = null }) {
  const esMantenimiento = estado === ESTADO_COMPUTADORA.MANTENIMIENTO;

  const computadora = await prisma.$transaction(async (tx) => {
    const actual = await tx.computadora.findUnique({
      where: { id: computadoraId },
      select: { id: true, codigo_inventario: true, estado: true },
    });

    if (!actual) throw ApiError.noEncontrado('La computadora indicada no existe.');

    if (esMantenimiento) {
      if (actual.estado === ESTADO_COMPUTADORA.MANTENIMIENTO) {
        throw ApiError.conflicto(`La computadora ${actual.codigo_inventario} ya está en mantenimiento.`);
      }
      if (actual.estado !== ESTADO_COMPUTADORA.DISPONIBLE) {
        throw ApiError.conflicto(
          `Solo se puede enviar a mantenimiento una computadora DISPONIBLE (estado actual: ${actual.estado}). ` +
            'Cerrá o cancelá el préstamo en curso primero.',
          { parametro: 'computadora_ocupada' },
        );
      }
    } else if (actual.estado !== ESTADO_COMPUTADORA.MANTENIMIENTO) {
      throw ApiError.conflicto(
        `Solo se puede reintegrar una computadora en MANTENIMIENTO (estado actual: ${actual.estado}).`,
      );
    }

    // Transición atómica: si otro operador la movió, count === 0 -> 409.
    const desde = esMantenimiento ? ESTADO_COMPUTADORA.DISPONIBLE : ESTADO_COMPUTADORA.MANTENIMIENTO;
    const cambio = await tx.computadora.updateMany({
      where: { id: computadoraId, estado: desde },
      data: { estado },
    });

    if (cambio.count === 0) {
      throw ApiError.conflicto('La computadora cambió de estado. Refrescá el panel y volvé a intentar.');
    }

    // Al reintegrar, los reportes abiertos de esa máquina quedan resueltos.
    if (!esMantenimiento) {
      await tx.reporteFalla.updateMany({
        where: { computadora_id: computadoraId, resuelto: false },
        data: { resuelto: true, estado: ESTADO_REPORTE.RESUELTO },
      });
    }

    return tx.computadora.findUnique({
      where: { id: computadoraId },
      include: INCLUIR_PRESTAMO_VIGENTE,
    });
  }, OPCIONES_TRANSACCION);

  const dto = serializarComputadora(computadora);
  realtime.emitirComputadoraActualizada(
    dto,
    esMantenimiento ? `mantenimiento_manual${motivo ? `:${motivo}` : ''}` : 'reintegro_mantenimiento',
  );

  return { computadora: dto };
}
