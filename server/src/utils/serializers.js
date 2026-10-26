/**
 * =============================================================================
 *  Serializadores (capa de presentación)
 * =============================================================================
 *  Traducen entidades de Prisma a DTOs "seguros" para la API:
 *   - Nunca exponen `password` ni datos internos.
 *   - Agregan campos calculados que el frontend necesita para los contadores
 *     regresivos (tiempo_restante_segundos, limite_retiro, vencido, ...).
 *   - El PIN (`token_validacion`) solo se incluye en endpoints propios del
 *     alumno dueño o del panel de secretaría, jamás en el catálogo público.
 * =============================================================================
 */

import { env } from '../config/env.js';
import { ESTADO_PRESTAMO, PRESTAMOS_VIGENTES } from '../config/constants.js';
import { segundosRestantesHasta, sumarMinutos, diferenciaEnSegundos } from './fechas.js';

/** Proyección pública de un usuario (sin password). */
export function serializarUsuario(usuario) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    dni: usuario.dni,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    nombre_completo: `${usuario.nombre} ${usuario.apellido}`.trim(),
    email: usuario.email,
    rol: usuario.rol,
    estado: usuario.estado,
    creado_en: usuario.creado_en,
  };
}

/** Versión reducida de una computadora (para embeber en préstamos). */
export function serializarComputadoraBasica(computadora) {
  if (!computadora) return null;
  return {
    id: computadora.id,
    codigo_inventario: computadora.codigo_inventario,
    modelo: computadora.modelo,
    estado: computadora.estado,
  };
}

/**
 * Momento en que una computadora quedaría libre:
 *  - RESERVADA   -> inicio + tolerancia de check-in (si nadie la retira, se libera).
 *  - EN_USO      -> fin estimado del préstamo.
 *  - Otros       -> null.
 */
export function calcularLiberacion(computadora, ahora = new Date()) {
  const prestamo = computadora?.prestamos?.[0] ?? null;
  if (!prestamo) return { liberacion_en: null, tiempo_restante_segundos: 0, prestamo_activo: null };

  const liberacion_en =
    prestamo.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO
      ? sumarMinutos(prestamo.fecha_hora_inicio, env.negocio.toleranciaCheckInMinutos)
      : prestamo.fecha_hora_fin_estimada;

  return {
    liberacion_en,
    tiempo_restante_segundos: segundosRestantesHasta(liberacion_en, ahora),
    // Sin el PIN: el catálogo es visible para todos los alumnos autenticados.
    prestamo_activo: {
      id: prestamo.id,
      estado: prestamo.estado,
      fecha_hora_inicio: prestamo.fecha_hora_inicio,
      fecha_hora_fin_estimada: prestamo.fecha_hora_fin_estimada,
      usuario: prestamo.usuario
        ? {
            nombre: prestamo.usuario.nombre,
            apellido: prestamo.usuario.apellido,
            // El DNI se expone parcialmente por privacidad.
            dni: prestamo.usuario.dni ? `****${String(prestamo.usuario.dni).slice(-3)}` : null,
          }
        : null,
    },
  };
}

/** DTO completo de computadora usado por el catálogo y los eventos de socket. */
export function serializarComputadora(computadora, ahora = new Date()) {
  if (!computadora) return null;
  return {
    id: computadora.id,
    codigo_inventario: computadora.codigo_inventario,
    modelo: computadora.modelo,
    especificaciones: computadora.especificaciones ?? null,
    estado: computadora.estado,
    actualizado_en: computadora.actualizado_en,
    ...calcularLiberacion(computadora, ahora),
  };
}

/**
 * DTO de un reporte de falla (Sprint 3).
 * @param {object} reporte
 * @param {{ incluirUsuario?: boolean }} [opciones]
 */
export function serializarReporteFalla(reporte, { incluirUsuario = true } = {}) {
  if (!reporte) return null;
  return {
    id: reporte.id,
    descripcion: reporte.descripcion,
    severidad: reporte.severidad,
    resuelto: reporte.resuelto,
    estado: reporte.estado,
    creado_en: reporte.creado_en,
    prestamo_id: reporte.prestamo_id ?? null,
    computadora_id: reporte.computadora_id ?? null,
    ...(incluirUsuario && reporte.usuario
      ? {
          usuario: {
            nombre: reporte.usuario.nombre,
            apellido: reporte.usuario.apellido,
            dni: reporte.usuario.dni ? `****${String(reporte.usuario.dni).slice(-3)}` : null,
          },
        }
      : {}),
  };
}

/**
 * DTO de préstamo.
 * @param {object} prestamo  Préstamo con (opcionalmente) usuario y computadora incluidos.
 * @param {{ mostrarPin?: boolean, ahora?: Date }} opciones
 */
export function serializarPrestamo(prestamo, { mostrarPin = false, ahora = new Date() } = {}) {
  if (!prestamo) return null;

  const vigente = PRESTAMOS_VIGENTES.includes(prestamo.estado);
  const esPendienteDeRetiro = prestamo.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO;

  return {
    id: prestamo.id,
    estado: prestamo.estado,
    fecha_hora_inicio: prestamo.fecha_hora_inicio,
    fecha_hora_fin_estimada: prestamo.fecha_hora_fin_estimada,
    fecha_hora_fin_real: prestamo.fecha_hora_fin_real ?? null,
    creado_en: prestamo.creado_en,
    // Comentarios registrados al entregar el equipo (US-06).
    observaciones_devolucion: prestamo.observaciones_devolucion ?? null,
    // Fallas reportadas durante el préstamo (US-08), si el include las trae.
    reportes: Array.isArray(prestamo.reportes) ? prestamo.reportes.map((reporte) => serializarReporteFalla(reporte)) : [],

    // --- Campos calculados para la UI -------------------------------------
    // Segundos restantes para la devolución (0 si no está vigente).
    tiempo_restante_segundos: vigente ? segundosRestantesHasta(prestamo.fecha_hora_fin_estimada, ahora) : 0,
    // El préstamo está ACTIVO y ya pasó su hora estimada de devolución.
    vencido: prestamo.estado === ESTADO_PRESTAMO.ACTIVO && prestamo.fecha_hora_fin_estimada <= ahora,
    // Límite para presentarse en secretaría (reservas pendientes de retiro).
    limite_retiro: esPendienteDeRetiro
      ? sumarMinutos(prestamo.fecha_hora_inicio, env.negocio.toleranciaCheckInMinutos)
      : null,
    // Segundos hasta que la reserva expire si el alumno no la retira.
    tiempo_para_retiro_segundos: esPendienteDeRetiro
      ? diferenciaEnSegundos(sumarMinutos(prestamo.fecha_hora_inicio, env.negocio.toleranciaCheckInMinutos), ahora)
      : 0,

    // --- Relaciones --------------------------------------------------------
    usuario: prestamo.usuario ? serializarUsuario(prestamo.usuario) : undefined,
    computadora: prestamo.computadora ? serializarComputadoraBasica(prestamo.computadora) : undefined,

    // El PIN solo viaja a quien debe conocerlo (alumno dueño o secretaría).
    ...(mostrarPin ? { token_validacion: prestamo.token_validacion } : {}),
  };
}
