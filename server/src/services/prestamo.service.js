/**
 * =============================================================================
 *  Servicio de préstamos - Núcleo de los Sprints 2 y 3
 * =============================================================================
 *  Ciclo de vida:
 *
 *      [DISPONIBLE] --reservar--> [RESERVADA] --check-in (PIN)--> [EN_USO]
 *                        |                                          |
 *              cancelar / NO-SHOW (job)              devolver / extender
 *                        v                                          v
 *              [CANCELADO_NO_SHOW]              [FINALIZADO] (+ ReporteFalla:
 *                                                 GRAVE/CRITICA -> MANTENIMIENTO)
 *
 *  ESTRATEGIA DE CONCURRENCIA (prevención de race conditions)
 *  ---------------------------------------------------------
 *  El punto crítico es "dos alumnos reservando la misma PC en el mismo
 *  milisegundo". Se resuelve con una TRANSICIÓN ATÓMICA (compare-and-swap) en
 *  lugar de leer-y-luego-escribir:
 *
 *      UPDATE computadoras SET estado = 'RESERVADA'
 *       WHERE id = $pc AND estado = 'DISPONIBLE'
 *
 *  `prisma.computadora.updateMany({ where: { id, estado: 'DISPONIBLE' } })`
 *  emite exactamente esa sentencia. Bajo el nivel de aislamiento por defecto de
 *  PostgreSQL (READ COMMITTED), si dos transacciones apuntan a la misma fila la
 *  segunda espera el bloqueo de fila; al desbloquearse reevalúa el WHERE y, como
 *  el estado ya cambió, devuelve `count = 0`. En ese caso la transacción lanza
 *  409 y no se crea ningún préstamo: la PC no puede quedar reservada dos veces.
 *
 *  Todo cambio de estado (préstamo + computadora) ocurre dentro de
 *  `prisma.$transaction`, por lo que o se aplican ambos o ninguno (ACID).
 *  Los eventos de Socket.io se emiten SIEMPRE después del commit: si la
 *  transacción falla, ningún cliente recibe información falsa.
 * =============================================================================
 */

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import {
  ESTADO_COMPUTADORA,
  ESTADO_PRESTAMO,
  ESTADO_REPORTE,
  MOTIVO_CANCELACION,
  PRESTAMOS_HISTORIAL,
  PRESTAMOS_VIGENTES,
  SEVERIDADES_CRITICAS,
} from '../config/constants.js';
import { sumarMinutos, yaPaso } from '../utils/fechas.js';
import { generarPin } from '../utils/pin.js';
import { serializarComputadora, serializarPrestamo, serializarReporteFalla } from '../utils/serializers.js';
import { INCLUIR_DETALLE_PRESTAMO, INCLUIR_PRESTAMO_VIGENTE } from '../data/includes.js';
import * as realtime from '../realtime/socket.js';

/** Opciones de las transacciones: tolera esperas de bloqueo razonables. */
const OPCIONES_TRANSACCION = { maxWait: 5000, timeout: 15000 };

/** Intentos para encontrar un PIN libre entre los préstamos vigentes. */
const MAX_INTENTOS_PIN = 25;

// -----------------------------------------------------------------------------
//  Helpers internos
// -----------------------------------------------------------------------------

/** Relee una computadora ya serializada (con su préstamo vigente) para emitirla por socket. */
async function computadoraSerializada(computadoraId) {
  const computadora = await prisma.computadora.findUnique({
    where: { id: computadoraId },
    include: INCLUIR_PRESTAMO_VIGENTE,
  });
  return computadora ? serializarComputadora(computadora) : null;
}

/**
 * Genera un PIN de 4 dígitos que no esté en uso por otro préstamo vigente.
 * La verificación ocurre dentro de la misma transacción de la reserva para
 * evitar que dos alumnos reciban el mismo PIN.
 */
async function generarPinUnico(tx) {
  for (let intento = 0; intento < MAX_INTENTOS_PIN; intento += 1) {
    const candidato = generarPin();
    const enUso = await tx.prestamo.findFirst({
      where: { token_validacion: candidato, estado: { in: PRESTAMOS_VIGENTES } },
      select: { id: true },
    });
    if (!enUso) return candidato;
  }
  throw ApiError.interno('No se pudo generar un PIN de retiro único. Volvé a intentar en unos segundos.');
}

/** Ventana de retiro de una reserva: [inicio - anticipación, inicio + tolerancia]. */
function calcularVentanaDeRetiro(prestamo) {
  return {
    desde: sumarMinutos(prestamo.fecha_hora_inicio, -env.negocio.anticipacionRetiroMinutos),
    hasta: sumarMinutos(prestamo.fecha_hora_inicio, env.negocio.toleranciaCheckInMinutos),
  };
}

/** Valida que la fecha de inicio solicitada esté dentro de la ventana permitida. */
function validarVentanaDeReserva(inicio, ahora) {
  const { anticipacionMaximaMinutos } = env.negocio;

  // Tolerancia de 1 minuto hacia atrás por desfases de reloj entre navegador y servidor.
  if (inicio.getTime() < ahora.getTime() - 60_000) {
    throw ApiError.badRequest('No podés reservar una computadora para una hora que ya pasó.');
  }

  const limiteSuperior = sumarMinutos(ahora, anticipacionMaximaMinutos);
  if (inicio.getTime() > limiteSuperior.getTime()) {
    throw ApiError.badRequest(
      `Solo podés programar la reserva con hasta ${anticipacionMaximaMinutos} minutos de anticipación.`,
      [{ campo: 'inicio_programado', mensaje: `La fecha no puede superar las ${limiteSuperior.toLocaleTimeString('es-AR')}.` }],
    );
  }
}

// -----------------------------------------------------------------------------
//  1) Reserva (alumno)
// -----------------------------------------------------------------------------

/**
 * Reserva una computadora para el alumno autenticado.
 * @param {{ usuarioId: string, computadoraId: string, inicioProgramado?: string|null }} params
 * @returns {Promise<{ prestamo: object, computadora: object }>}
 */
export async function reservar({ usuarioId, computadoraId, inicioProgramado = null }) {
  const ahora = new Date();
  const inicio = inicioProgramado ? new Date(inicioProgramado) : new Date(ahora);

  validarVentanaDeReserva(inicio, ahora);

  const finEstimada = sumarMinutos(inicio, env.negocio.duracionPrestamoMinutos);

  // ---- Transacción ACID ----------------------------------------------------
  const prestamo = await prisma.$transaction(async (tx) => {
    // (a) El alumno debe existir (el middleware valida el token, esto cierra la carrera por borrado).
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nombre: true, apellido: true },
    });
    if (!usuario) throw ApiError.noEncontrado('El usuario no existe.');

    // (b) Regla de negocio: un alumno, un préstamo vigente a la vez.
    const vigente = await tx.prestamo.findFirst({
      where: { usuario_id: usuarioId, estado: { in: PRESTAMOS_VIGENTES } },
      select: { id: true, estado: true, computadora: { select: { codigo_inventario: true } } },
    });
    if (vigente) {
      throw ApiError.conflicto(
        `Ya tenés un préstamo vigente sobre ${vigente.computadora.codigo_inventario}. ` +
          'Devolvé el equipo o cancelá la reserva antes de solicitar otro.',
        { parametro: 'prestamo_vigente' },
      );
    }

    // (c) La computadora debe existir y ser reservable.
    const computadora = await tx.computadora.findUnique({
      where: { id: computadoraId },
      select: { id: true, codigo_inventario: true, estado: true },
    });
    if (!computadora) throw ApiError.noEncontrado('La computadora indicada no existe.');

    if (computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO) {
      throw ApiError.conflicto(
        `La computadora ${computadora.codigo_inventario} está en mantenimiento y no puede reservarse.`,
      );
    }

    // (d) TRANSICIÓN ATÓMICA: solo pasa a RESERVADA si sigue DISPONIBLE.
    //     Si otro alumno ganó la carrera, count === 0 y abortamos la transacción.
    const bloqueo = await tx.computadora.updateMany({
      where: { id: computadoraId, estado: ESTADO_COMPUTADORA.DISPONIBLE },
      data: { estado: ESTADO_COMPUTADORA.RESERVADA },
    });

    if (bloqueo.count === 0) {
      throw ApiError.conflicto(
        `La computadora ${computadora.codigo_inventario} acaba de ser tomada por otro usuario. Elegí otra del catálogo.`,
        { parametro: 'computadora_ocupada', computadora_id: computadoraId },
      );
    }

    // (e) PIN de retiro y creación del préstamo.
    const token_validacion = await generarPinUnico(tx);

    return tx.prestamo.create({
      data: {
        usuario_id: usuarioId,
        computadora_id: computadoraId,
        fecha_hora_inicio: inicio,
        fecha_hora_fin_estimada: finEstimada,
        token_validacion,
        estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO,
      },
      include: INCLUIR_DETALLE_PRESTAMO,
    });
  }, OPCIONES_TRANSACCION);

  // ---- Post-commit: notificar a todos los clientes conectados --------------
  const computadora = await computadoraSerializada(prestamo.computadora_id);
  const prestamoDTO = serializarPrestamo(prestamo, { mostrarPin: true });

  realtime.emitirComputadoraActualizada(computadora, 'nueva_reserva');
  realtime.emitirNuevoPrestamo(prestamoDTO);

  return { prestamo: prestamoDTO, computadora };
}

// -----------------------------------------------------------------------------
//  2) Check-in presencial (secretaría, validando el PIN)
// -----------------------------------------------------------------------------

/**
 * Valida el PIN del alumno y pone la computadora EN_USO.
 * @param {{ token: string, secretarioId: string }} params
 * @returns {Promise<{ prestamo: object, computadora: object }>}
 */
export async function hacerCheckIn({ token, secretarioId }) {
  const ahora = new Date();

  // Lectura previa: permite dar mensajes de error precisos sin abrir transacción.
  const reserva = await prisma.prestamo.findFirst({
    where: { token_validacion: token, estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO },
    include: INCLUIR_DETALLE_PRESTAMO,
  });

  if (!reserva) {
    // Se diferencia "PIN inexistente" de "PIN ya procesado" para ayudar a la secretaría.
    const yaProcesado = await prisma.prestamo.findFirst({
      where: {
        token_validacion: token,
        estado: { in: [ESTADO_PRESTAMO.ACTIVO, ESTADO_PRESTAMO.FINALIZADO, ESTADO_PRESTAMO.CANCELADO_NO_SHOW] },
      },
      select: { id: true, estado: true, computadora: { select: { codigo_inventario: true } } },
    });

    if (yaProcesado) {
      throw ApiError.conflicto(
        yaProcesado.estado === ESTADO_PRESTAMO.CANCELADO_NO_SHOW
          ? `Ese PIN pertenece a una reserva cancelada por no presentarse a retirar (${yaProcesado.computadora.codigo_inventario}).`
          : `Ese PIN pertenece a un préstamo ya validado (${yaProcesado.estado}) sobre ${yaProcesado.computadora.codigo_inventario}.`,
      );
    }

    throw ApiError.noEncontrado('PIN inválido: no hay ninguna reserva pendiente de retiro con ese código.');
  }

  // ---- Reglas de la ventana de retiro --------------------------------------
  const { desde, hasta } = calcularVentanaDeRetiro(reserva);

  if (yaPaso(hasta, ahora)) {
    // La reserva venció: se cancela en el momento y se libera la computadora.
    await cancelarReservaVencida(reserva, MOTIVO_CANCELACION.EXPIRACION);
    throw ApiError.conflicto(
      `La reserva venció: el alumno no se presentó dentro de los ${env.negocio.toleranciaCheckInMinutos} minutos de tolerancia y el equipo fue liberado.`,
      { parametro: 'reserva_vencida' },
    );
  }

  if (ahora.getTime() < desde.getTime()) {
    throw ApiError.conflicto(
      `Todavía no es el horario del retiro. La reserva se habilita a las ${desde.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.`,
      { parametro: 'retiro_anticipado' },
    );
  }

  // ---- Transacción ACID ----------------------------------------------------
  const prestamo = await prisma.$transaction(async (tx) => {
    // La PC debe seguir RESERVADA. Si no lo está, otro proceso la movió.
    const cambioPc = await tx.computadora.updateMany({
      where: { id: reserva.computadora_id, estado: ESTADO_COMPUTADORA.RESERVADA },
      data: { estado: ESTADO_COMPUTADORA.EN_USO },
    });

    if (cambioPc.count === 0) {
      throw ApiError.conflicto(
        'La computadora cambió de estado y no puede entregarse. Refrescá el panel y verificá el inventario.',
      );
    }

    // Se guarda el estado anterior para detectar doble check-in concurrente.
    const cambioPrestamo = await tx.prestamo.updateMany({
      where: { id: reserva.id, estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO },
      data: {
        estado: ESTADO_PRESTAMO.ACTIVO,
        // El préstamo empieza a contar cuando la secretaría entrega el equipo:
        // si el alumno llegó antes, se corre el reloj; si llegó tarde, también.
        fecha_hora_inicio: ahora,
        fecha_hora_fin_estimada: sumarMinutos(ahora, env.negocio.duracionPrestamoMinutos),
      },
    });

    if (cambioPrestamo.count === 0) {
      throw ApiError.conflicto('La reserva ya fue procesada por otro operador.');
    }

    return tx.prestamo.findUnique({
      where: { id: reserva.id },
      include: INCLUIR_DETALLE_PRESTAMO,
    });
  }, OPCIONES_TRANSACCION);

  const computadora = await computadoraSerializada(prestamo.computadora_id);
  const prestamoDTO = serializarPrestamo(prestamo, { mostrarPin: true });

  realtime.emitirComputadoraActualizada(computadora, 'check_in');
  realtime.emitirPrestamoActualizado(prestamoDTO, `check_in_por_${secretarioId}`);

  return { prestamo: prestamoDTO, computadora };
}

// -----------------------------------------------------------------------------
//  3) Devolución del equipo (US-06) y extensión (US-05)
// -----------------------------------------------------------------------------

/**
 * Cierra un préstamo ACTIVO: registra la hora real de devolución, guarda las
 * observaciones y, si se informa una falla, crea el ReporteFalla.
 *
 * Reglas de estado de la computadora (todas con compare-and-swap sobre EN_USO):
 *   - Falla GRAVE o CRITICA -> MANTENIMIENTO (queda fuera de servicio sola).
 *   - Sin falla (o falla LEVE) -> DISPONIBLE.
 *   - Si secretaría ya la marcó en MANTENIMIENTO, esa decisión prevalece.
 *
 * Lo pueden invocar el alumno titular (devolución con feedback) o la
 * secretaría en el mostrador (recepción física). La transacción garantiza que
 * solo un actor cierre el préstamo: el segundo recibe 409.
 *
 * @param {{ prestamoId: string, actorId: string, esSecretario: boolean,
 *           observaciones?: string|null,
 *           reporte?: { severidad: string, descripcion: string }|null }} params
 * @returns {Promise<{ prestamo: object, computadora: object, reporte: object|null }>}
 */
export async function devolver({ prestamoId, actorId, esSecretario = false, observaciones = null, reporte = null }) {
  const ahora = new Date();
  const esFallaGrave = Boolean(reporte && SEVERIDADES_CRITICAS.includes(reporte.severidad));

  const resultado = await prisma.$transaction(async (tx) => {
    // 1) Lectura previa: permisos y mensaje de error preciso.
    const actual = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      select: { id: true, usuario_id: true, computadora_id: true, estado: true },
    });

    if (!actual) throw ApiError.noEncontrado('El préstamo indicado no existe.');
    if (!esSecretario && actual.usuario_id !== actorId) {
      throw ApiError.prohibido('Solo el alumno titular puede registrar la devolución de este préstamo.');
    }

    // 2) Transición atómica: solo un préstamo ACTIVO puede cerrarse.
    const cambioPrestamo = await tx.prestamo.updateMany({
      where: { id: prestamoId, estado: ESTADO_PRESTAMO.ACTIVO },
      data: {
        estado: ESTADO_PRESTAMO.FINALIZADO,
        fecha_hora_fin_real: ahora,
        observaciones_devolucion: observaciones ?? null,
        alerta_vencimiento_enviada: false,
      },
    });

    if (cambioPrestamo.count === 0) {
      throw ApiError.conflicto(
        `Solo se pueden devolver préstamos ACTIVOS (estado actual: ${actual.estado}).`,
      );
    }

    // 3) Reporte de falla (US-08): se asocia al préstamo y a la máquina.
    let reporteCreado = null;
    if (reporte) {
      reporteCreado = await tx.reporteFalla.create({
        data: {
          usuario_id: actorId,
          computadora_id: actual.computadora_id,
          prestamo_id: prestamoId,
          descripcion: reporte.descripcion,
          severidad: reporte.severidad,
          estado: ESTADO_REPORTE.PENDIENTE,
          resuelto: false,
        },
      });
    }

    // 4) Estado de la máquina según la severidad de lo reportado.
    await tx.computadora.updateMany({
      where: { id: actual.computadora_id, estado: ESTADO_COMPUTADORA.EN_USO },
      data: { estado: esFallaGrave ? ESTADO_COMPUTADORA.MANTENIMIENTO : ESTADO_COMPUTADORA.DISPONIBLE },
    });

    const prestamo = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      include: INCLUIR_DETALLE_PRESTAMO,
    });
    return { prestamo, reporteCreado };
  }, OPCIONES_TRANSACCION);

  // ---- Post-commit: notificar (el broadcast incluye el nuevo estado) ------
  const computadora = await computadoraSerializada(resultado.prestamo.computadora_id);
  const prestamoDTO = serializarPrestamo(resultado.prestamo, { mostrarPin: true });
  const reporteDTO = serializarReporteFalla(resultado.reporteCreado, { incluirUsuario: false });

  realtime.emitirComputadoraActualizada(computadora, esFallaGrave ? 'devolucion_con_falla' : 'devolucion');
  realtime.emitirPrestamoActualizado(prestamoDTO, `devolucion_por_${esSecretario ? 'secretaria' : 'alumno'}`);

  return { prestamo: prestamoDTO, computadora, reporte: reporteDTO };
}

/**
 * Ruta de secretaría: recepción física del equipo en el mostrador.
 * Misma transacción que `devolver`, sin reporte de falla (la secretaría puede
 * agregarlo después desde el panel de mantenimiento).
 * @param {{ prestamoId: string, secretarioId: string, observaciones?: string }} params
 */
export async function finalizar({ prestamoId, secretarioId, observaciones = null }) {
  return devolver({ prestamoId, actorId: secretarioId, esSecretario: true, observaciones, reporte: null });
}

/**
 * Extiende un préstamo ACTIVO en EXTENSION_PRESTAMO_MINUTOS (US-05).
 * Solo el alumno titular. Rechaza (409) si la máquina tiene otra reserva
 * programada dentro de la ventana futura: en ese caso liberarla a tiempo
 * sería imposible y el turno siguiente se perdería.
 *
 * @param {{ prestamoId: string, usuarioId: string }} params
 * @returns {Promise<{ prestamo: object, computadora: object }>}
 */
export async function extender({ prestamoId, usuarioId }) {
  const ahora = new Date();

  const prestamo = await prisma.$transaction(async (tx) => {
    const actual = await tx.prestamo.findUnique({
      where: { id: prestamoId },
      select: {
        id: true,
        usuario_id: true,
        computadora_id: true,
        estado: true,
        fecha_hora_fin_estimada: true,
        computadora: { select: { codigo_inventario: true } },
      },
    });

    if (!actual) throw ApiError.noEncontrado('El préstamo indicado no existe.');
    if (actual.usuario_id !== usuarioId) {
      throw ApiError.prohibido('Solo el alumno titular puede solicitar la extensión del préstamo.');
    }
    if (actual.estado !== ESTADO_PRESTAMO.ACTIVO) {
      throw ApiError.conflicto(
        `Solo se pueden extender préstamos ACTIVOS (estado actual: ${actual.estado}).`,
      );
    }

    // ¿Hay otra reserva programada en la siguiente hora sobre esta máquina?
    const reservaPosterior = await tx.prestamo.findFirst({
      where: {
        computadora_id: actual.computadora_id,
        id: { not: actual.id },
        estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO,
        fecha_hora_inicio: {
          gte: ahora,
          lte: sumarMinutos(ahora, env.negocio.ventanaExtensionReservaMinutos),
        },
      },
      select: { fecha_hora_inicio: true },
    });

    if (reservaPosterior) {
      throw ApiError.conflicto(
        `No se puede extender: ${actual.computadora.codigo_inventario} tiene una reserva programada para las ` +
          `${reservaPosterior.fecha_hora_inicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. ` +
          'Devolvé el equipo a tiempo para respetar el turno siguiente.',
        { parametro: 'reserva_posterior', fecha_hora_inicio: reservaPosterior.fecha_hora_inicio },
      );
    }

    // CAS: si el préstamo dejó de estar ACTIVO entre la lectura y acá, 409.
    const cambio = await tx.prestamo.updateMany({
      where: { id: prestamoId, estado: ESTADO_PRESTAMO.ACTIVO },
      data: {
        fecha_hora_fin_estimada: sumarMinutos(actual.fecha_hora_fin_estimada, env.negocio.extensionPrestamoMinutos),
        // Se reactiva la alerta: el nuevo vencimiento debe avisar de nuevo.
        alerta_vencimiento_enviada: false,
      },
    });

    if (cambio.count === 0) {
      throw ApiError.conflicto('El préstamo cambió de estado y no puede extenderse. Refrescá la vista.');
    }

    return tx.prestamo.findUnique({ where: { id: prestamoId }, include: INCLUIR_DETALLE_PRESTAMO });
  }, OPCIONES_TRANSACCION);

  // ---- Post-commit: actualizar tiempos en el alumno y en secretaría -------
  const computadora = await computadoraSerializada(prestamo.computadora_id);
  const prestamoDTO = serializarPrestamo(prestamo, { mostrarPin: true });

  realtime.emitirComputadoraActualizada(computadora, 'extension');
  realtime.emitirPrestamoActualizado(prestamoDTO, 'extension');

  return { prestamo: prestamoDTO, computadora };
}

// -----------------------------------------------------------------------------
//  4) Cancelación
// -----------------------------------------------------------------------------

/**
 * Cancela una reserva PENDIENTE_RETIRO.
 * @param {{ prestamoId: string, usuarioId?: string|null, motivo: string }} params
 *        Si `usuarioId` viene informado se exige que sea el dueño (alumno).
 */
export async function cancelar({ prestamoId, usuarioId = null, motivo = MOTIVO_CANCELACION.ALUMNO }) {
  const resultado = await prisma.$transaction(async (tx) => {
    const cambio = await tx.prestamo.updateMany({
      where: {
        id: prestamoId,
        estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO,
        ...(usuarioId ? { usuario_id: usuarioId } : {}),
      },
      data: { estado: ESTADO_PRESTAMO.CANCELADO },
    });

    if (cambio.count === 0) {
      throw ApiError.conflicto(
        'No se pudo cancelar: la reserva no existe, ya fue procesada o no te pertenece.',
      );
    }

    const prestamo = await tx.prestamo.findUnique({ where: { id: prestamoId }, include: INCLUIR_DETALLE_PRESTAMO });

    await tx.computadora.updateMany({
      where: { id: prestamo.computadora_id, estado: ESTADO_COMPUTADORA.RESERVADA },
      data: { estado: ESTADO_COMPUTADORA.DISPONIBLE },
    });

    return prestamo;
  }, OPCIONES_TRANSACCION);

  const computadora = await computadoraSerializada(resultado.computadora_id);
  const prestamoDTO = serializarPrestamo(resultado, { mostrarPin: true });

  realtime.emitirComputadoraActualizada(computadora, motivo);
  realtime.emitirPrestamoActualizado(prestamoDTO, motivo);

  return { prestamo: prestamoDTO, computadora };
}

/**
 * Cancela una reserva vencida por falta de retiro (política NO-SHOW, Sprint 3).
 * La usa el job de expiración y el check-in tardío. Es idempotente: si otro
 * proceso ya la procesó, no hace nada.
 */
async function cancelarReservaVencida(reserva, motivo = MOTIVO_CANCELACION.EXPIRACION) {
  const resultado = await prisma.$transaction(async (tx) => {
    const cambio = await tx.prestamo.updateMany({
      where: { id: reserva.id, estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO },
      data: { estado: ESTADO_PRESTAMO.CANCELADO_NO_SHOW },
    });

    if (cambio.count === 0) return null; // Ya fue procesada por otro camino.

    await tx.computadora.updateMany({
      where: { id: reserva.computadora_id, estado: ESTADO_COMPUTADORA.RESERVADA },
      data: { estado: ESTADO_COMPUTADORA.DISPONIBLE },
    });

    return tx.prestamo.findUnique({ where: { id: reserva.id }, include: INCLUIR_DETALLE_PRESTAMO });
  }, OPCIONES_TRANSACCION);

  if (!resultado) return null;

  const computadora = await computadoraSerializada(resultado.computadora_id);
  const prestamoDTO = serializarPrestamo(resultado, { mostrarPin: true });

  realtime.emitirComputadoraActualizada(computadora, motivo);
  realtime.emitirPrestamoActualizado(prestamoDTO, motivo);
  realtime.emitirReservaExpirada(prestamoDTO, computadora);

  return { prestamo: prestamoDTO, computadora };
}

// -----------------------------------------------------------------------------
//  5) Consultas
// -----------------------------------------------------------------------------

/**
 * Préstamo vigente + historial reciente del alumno autenticado.
 * @param {string} usuarioId
 */
export async function obtenerMisPrestamos(usuarioId) {
  const [vigente, historial] = await Promise.all([
    prisma.prestamo.findFirst({
      where: { usuario_id: usuarioId, estado: { in: PRESTAMOS_VIGENTES } },
      orderBy: { creado_en: 'desc' },
      include: INCLUIR_DETALLE_PRESTAMO,
    }),
    prisma.prestamo.findMany({
      where: { usuario_id: usuarioId, estado: { in: PRESTAMOS_HISTORIAL } },
      orderBy: { creado_en: 'desc' },
      take: 8,
      include: INCLUIR_DETALLE_PRESTAMO,
    }),
  ]);

  const ahora = new Date();
  return {
    vigente: serializarPrestamo(vigente, { mostrarPin: true, ahora }),
    historial: historial.map((prestamo) => serializarPrestamo(prestamo, { mostrarPin: true, ahora })),
  };
}

/**
 * Préstamos vigentes para el panel de secretaría.
 * @returns {Promise<{ pendientes: object[], activos: object[], todos: object[] }>}
 */
export async function listarPrestamosVigentes() {
  const prestamos = await prisma.prestamo.findMany({
    where: { estado: { in: PRESTAMOS_VIGENTES } },
    orderBy: [{ estado: 'asc' }, { fecha_hora_inicio: 'asc' }],
    include: INCLUIR_DETALLE_PRESTAMO,
  });

  const ahora = new Date();
  const serializados = prestamos.map((prestamo) => serializarPrestamo(prestamo, { mostrarPin: true, ahora }));

  return {
    pendientes: serializados.filter((p) => p.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO),
    activos: serializados.filter((p) => p.estado === ESTADO_PRESTAMO.ACTIVO),
    todos: serializados,
  };
}

// -----------------------------------------------------------------------------
//  6) Job de expiración
// -----------------------------------------------------------------------------

/**
 * Libera las reservas que nunca fueron retiradas (PENDIENTE_RETIRO cuyo límite
 * de retiro ya pasó). Corresponde a la política de NO-SHOW: el préstamo pasa a
 * CANCELADO_NO_SHOW y la máquina vuelve a estar disponible. Se ejecuta
 * periódicamente desde src/jobs y también al arrancar el servidor, de modo que
 * el estado del inventario se autocorrige.
 * @returns {Promise<number>} cantidad de reservas expiradas procesadas
 */
export async function expirarReservasVencidas() {
  const limite = sumarMinutos(new Date(), -env.negocio.toleranciaCheckInMinutos);

  const vencidas = await prisma.prestamo.findMany({
    where: {
      estado: ESTADO_PRESTAMO.PENDIENTE_RETIRO,
      // inicio + tolerancia < ahora  <=>  inicio < ahora - tolerancia
      fecha_hora_inicio: { lt: limite },
    },
    include: INCLUIR_DETALLE_PRESTAMO,
  });

  let procesadas = 0;
  for (const reserva of vencidas) {
    try {
      const resultado = await cancelarReservaVencida(reserva);
      if (resultado) procesadas += 1;
    } catch (error) {
      // Una reserva problemática no debe frenar el resto del lote.
      console.error(`[job:expiracion] Falló al expirar la reserva ${reserva.id}:`, error.message);
    }
  }

  return procesadas;
}
