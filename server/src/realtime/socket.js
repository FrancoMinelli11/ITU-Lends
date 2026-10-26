/**
 * =============================================================================
 *  Capa de tiempo real (Socket.io)
 * =============================================================================
 *  Responsabilidades:
 *   1. Inicializar el servidor de WebSockets sobre el mismo servidor HTTP.
 *   2. Autenticar la conexión con el JWT (opcional pero verificado: si el
 *      cliente envía un token inválido la conexión se rechaza).
 *   3. Exponer funciones de emisión tipadas (una por evento del dominio) que
 *      SIEMPRE inyectan `servidor_timestamp`, con el que el frontend corrige el
 *      desfase de reloj y mantiene los contadores regresivos sincronizados.
 *
 *  SEGMENTACIÓN POR SALAS (privacidad del PIN)
 *  -------------------------------------------
 *  `computadora_actualizada` es público: solo describe el inventario y se
 *  difunde a todos los clientes conectados.
 *  Los eventos de préstamo incluyen el PIN de retiro (`token_validacion`), por
 *  lo que NO se difunden globalmente: se emiten únicamente a la sala
 *  `secretaria` y a la sala del alumno dueño (`usuario:<id>`). Así ningún
 *  alumno puede conocer el PIN de una reserva ajena.
 *
 *  Los servicios de dominio NUNCA importan Socket.io: llaman a estas funciones
 *  después de que la transacción fue confirmada.
 * =============================================================================
 */

import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { EVENTOS_SOCKET } from '../config/constants.js';
import { verificarToken } from '../utils/token.js';

/** Instancia única del servidor de sockets (null antes de inicializar). */
let io = null;

/** Sala de todo el personal de secretaría (ve PINs y la cola completa). */
export const SALA_SECRETARIA = 'secretaria';

/** Sala privada de un alumno: solo recibe los eventos de sus propios préstamos. */
const salaUsuario = (usuarioId) => `usuario:${usuarioId}`;

/**
 * Autenticación de la conexión WebSocket.
 * El frontend envía `{ auth: { token } }`. Se permite la conexión anónima
 * (solo lectura del catálogo público), pero si viene un token se verifica
 * estrictamente y se adjunta el usuario al socket.
 */
function autenticarSocket(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.data.usuario = null;
    return next();
  }

  try {
    const payload = verificarToken(token);
    socket.data.usuario = { id: payload.sub, rol: payload.rol, dni: payload.dni };
    socket.data.autenticado = true;
    return next();
  } catch (error) {
    // Token inválido o expirado: no se permite la conexión.
    return next(new Error(error.message ?? 'Token de socket inválido.'));
  }
}

/**
 * Inicializa Socket.io.
 * @param {import('http').Server} servidorHttp
 * @returns {import('socket.io').Server}
 */
export function iniciarSocket(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: {
      origin: env.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Reconexión gestionada por el cliente; el servidor tolera desconexiones.
    pingTimeout: 20000,
    pingInterval: 25000,
    path: '/socket.io',
  });

  io.use(autenticarSocket);

  io.on('connection', (socket) => {
    const usuarioSocket = socket.data.usuario;

    // Salas: cada cliente entra a la suya; secretaría además a la sala común.
    if (usuarioSocket?.id) {
      socket.join(salaUsuario(usuarioSocket.id));
      if (usuarioSocket.rol === 'SECRETARIO') socket.join(SALA_SECRETARIA);
    }

    const etiqueta = socket.data.autenticado
      ? `usuario ${usuarioSocket?.id} (${usuarioSocket?.rol})`
      : 'anónimo';

    if (env.esDesarrollo) {
      console.log(`[socket] Conexión establecida: ${socket.id} - ${etiqueta}`);
    }

    // Saludo inicial con la hora del servidor -> primer ajuste de reloj.
    socket.emit(EVENTOS_SOCKET.CONECTADO, {
      mensaje: 'Conectado al canal de actualizaciones en tiempo real.',
      servidor_timestamp: Date.now(),
    });

    /**
     * Handshake de sincronización de hora solicitado por el cliente.
     * A través del ack el cliente puede medir el RTT y estimar el offset.
     */
    socket.on(EVENTOS_SOCKET.SINCRONIZAR_HORA, (ack) => {
      const respuesta = { servidor_timestamp: Date.now() };
      if (typeof ack === 'function') ack(respuesta);
      else socket.emit(EVENTOS_SOCKET.CONECTADO, respuesta);
    });

    socket.on('disconnect', (motivo) => {
      if (env.esDesarrollo) {
        console.log(`[socket] Desconexión: ${socket.id} (${motivo})`);
      }
    });

    // Los errores de un socket no deben tumbar el proceso.
    socket.on('error', (error) => {
      console.error(`[socket] Error en ${socket.id}:`, error?.message ?? error);
    });
  });

  console.log('[socket] Servidor de eventos en tiempo real inicializado.');
  return io;
}

/** Emisión genérica privada: difunde a todos e inyecta la hora del servidor. */
function emitir(evento, payload) {
  if (!io) {
    // Ocurre solo si se emite antes de inicializar sockets (tests/scripts).
    return;
  }
  io.emit(evento, { ...payload, servidor_timestamp: Date.now() });
}

/** Emisión dirigida: solo a las salas indicadas (unión de salas). */
function emitirSalas(salas, evento, payload) {
  if (!io) return;
  io.to(salas).emit(evento, { ...payload, servidor_timestamp: Date.now() });
}

/**
 * Audiencia de un evento de préstamo: la secretaría y el alumno dueño.
 * Se exporta para poder verificarla en las pruebas sin un servidor real.
 * @param {object} prestamo DTO serializado (debe incluir `usuario.id`).
 * @returns {string[]} nombres de sala
 */
export function audienciaDePrestamo(prestamo) {
  const salas = [SALA_SECRETARIA];
  const usuarioId = prestamo?.usuario?.id;
  if (usuarioId) salas.push(salaUsuario(usuarioId));
  // Si el DTO llegara sin usuario, se mantiene solo secretaría: se prioriza no
  // filtrar el PIN antes que la comodidad de un broadcast.
  return salas;
}

// -----------------------------------------------------------------------------
//  API pública de emisión (una función por evento del contrato)
// -----------------------------------------------------------------------------

/**
 * Cambió el estado de una computadora (reservada, en uso, liberada, ...).
 * Es el evento más importante: todos los clientes sincronizan su catálogo.
 * @param {object} computadora DTO ya serializado (ver utils/serializers.js).
 * @param {string} [motivo]
 */
export function emitirComputadoraActualizada(computadora, motivo = 'cambio_de_estado') {
  emitir(EVENTOS_SOCKET.COMPUTADORA_ACTUALIZADA, { computadora, motivo });
}

/** Se creó un préstamo/reserva (alimenta el panel de secretaría en vivo). */
export function emitirNuevoPrestamo(prestamo) {
  emitirSalas(audienciaDePrestamo(prestamo), EVENTOS_SOCKET.NUEVO_PRESTAMO, { prestamo });
}

/** Cambió el estado de un préstamo (check-in, finalización, cancelación). */
export function emitirPrestamoActualizado(prestamo, motivo = 'actualizacion') {
  emitirSalas(audienciaDePrestamo(prestamo), EVENTOS_SOCKET.PRESTAMO_ACTUALIZADO, { prestamo, motivo });
}

/** Una reserva expiró por falta de retiro y la computadora quedó libre. */
export function emitirReservaExpirada(prestamo, computadora) {
  emitirSalas(audienciaDePrestamo(prestamo), EVENTOS_SOCKET.RESERVA_EXPIRADA, { prestamo, computadora });
}

/**
 * Un préstamo activo está por vencer (≤ ALERTA_VENCIMIENTO_MINUTOS restantes).
 * Va solo a la secretaría y al alumno dueño: mismo criterio de privacidad que
 * el resto de los eventos de préstamo.
 * @param {object} prestamo DTO serializado sin PIN.
 */
export function emitirPrestamoPorVencer(prestamo) {
  emitirSalas(audienciaDePrestamo(prestamo), EVENTOS_SOCKET.PRESTAMO_POR_VENCER, { prestamo });
}

/** Cierre ordenado del servidor de sockets. */
export async function cerrarSocket() {
  if (!io) return;
  await io.close();
  io = null;
  console.log('[socket] Servidor de sockets cerrado.');
}

/** Acceso controlado a la instancia (útil para métricas o tests). */
export const obtenerIo = () => io;

/**
 * Emite de forma agrupada las actualizaciones derivadas de un mismo cambio de
 * estado, evitando repetir la lógica en cada servicio.
 */
export function emitirCambioDePrestamo({ prestamo, computadoraSerializada, motivo }) {
  if (computadoraSerializada) emitirComputadoraActualizada(computadoraSerializada, motivo);
  emitirPrestamoActualizado(prestamo, motivo);
}
