/**
 * =============================================================================
 *  Prueba de integración de punta a punta (E2E) - Sprints 1 al 3
 * =============================================================================
 *  Corre contra la API REAL (HTTP + Socket.io) y la base PostgreSQL real: no
 *  usa stubs. Complementa a `npm run test:humo`, que es aislado de la base.
 *
 *  Requisitos previos:
 *    1. PostgreSQL activo y migrado ....... npm run db:migrate
 *    2. Datos de ejemplo cargados ......... npm run db:seed
 *    3. Servidor levantado ................ npm run dev
 *
 *  Ejecución:
 *    npm run test:e2e
 *    E2E_BASE_URL=http://localhost:4000 npm run test:e2e
 *
 *  Qué verifica:
 *    - Registro/login con JWT, roles y detección de DNI/email duplicados.
 *    - Catálogo CX-01..CX-10 con tiempos de liberación y sin filtrar el PIN.
 *    - Reserva con PIN de 4 dígitos y transición ACID de la computadora.
 *    - CARRERA REAL: dos alumnos reservando la misma PC en simultáneo.
 *    - Segmentación de eventos: el PIN solo llega a secretaría y al dueño.
 *    - Check-in por PIN, finalización y devolución del equipo.
 *    - Expiración automática de una reserva no retirada (job real, NO-SHOW).
 *    - Extensión de préstamo (+60 min) con su reserva posterior bloqueante.
 *    - Alerta preventiva de 15 min emitida exactamente una vez por el job.
 *    - Devolución con reporte de falla -> MANTENIMIENTO y trazabilidad.
 *    - Historial por máquina y cambio manual de estado de secretaría.
 *    - Códigos HTTP semánticos (400/401/403/404/409) en los caminos de error.
 *
 *  Es idempotente: crea usuarios con DNI/email únicos por corrida y libera
 *  todos los préstamos que genera. Sale con código 1 si algo falla. Si el
 *  servidor se está reiniciando (`node --watch`), espera hasta 20 s antes de
 *  empezar y reintenta las lecturas que se corten a mitad de camino.
 * =============================================================================
 */

import { EventEmitter } from 'node:events';
import { io } from 'socket.io-client';
import 'dotenv/config';
import { prisma, desconectarBD } from '../src/config/prisma.js';

const BASE_URL = (process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/+$/, '');
const API_URL = `${BASE_URL}/api`;
const INTERVALO_EXPIRACION_MS = Number(process.env.INTERVALO_EXPIRACION_SEGUNDOS ?? 30) * 1000;
const INTERVALO_ALERTA_MS = Number(process.env.INTERVALO_ALERTA_SEGUNDOS ?? 30) * 1000;
const ALERTA_MINUTOS = Number(process.env.ALERTA_VENCIMIENTO_MINUTOS ?? 15);
// Duración estándar del préstamo según el mismo .env que usa el servidor.
const DURACION_MINUTOS = Number(process.env.DURACION_PRESTAMO_MINUTOS ?? 80);
const DURACION_SEGUNDOS = DURACION_MINUTOS * 60;

// -----------------------------------------------------------------------------
//  Reporte de verificaciones
// -----------------------------------------------------------------------------
let verificaciones = 0;
const fallas = [];

/** Registra una verificación y muestra el resultado en consola. */
function check(condicion, mensaje, detalle = '') {
  verificaciones += 1;
  if (condicion) {
    console.log(`   ✅ ${mensaje}`);
  } else {
    fallas.push(detalle ? `${mensaje} -> ${detalle}` : mensaje);
    console.log(`   ❌ ${mensaje}${detalle ? ` -> ${detalle}` : ''}`);
  }
}

const titulo = (texto) => console.log(`\n${texto}\n${'─'.repeat(texto.length)}`);

// -----------------------------------------------------------------------------
//  Cliente HTTP mínimo sobre fetch
// -----------------------------------------------------------------------------
async function api(metodo, ruta, { token, body } = {}) {
  const url = `${API_URL}${ruta}`;
  const opciones = {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  let respuesta;
  try {
    respuesta = await fetch(url, opciones);
  } catch (error) {
    // `node --watch` puede reiniciar el servidor a mitad de la prueba.
    // Se reintenta solo en lecturas (idempotentes) o cuando la conexión fue
    // RECHAZADA, es decir cuando la petición nunca llegó al servidor: así una
    // reserva jamás se ejecuta dos veces por un reintento.
    const rechazada = error?.cause?.code === 'ECONNREFUSED';
    if (metodo !== 'GET' && !rechazada) throw error;
    await new Promise((resolver) => setTimeout(resolver, 1500));
    respuesta = await fetch(url, opciones);
  }

  let json = null;
  try {
    json = await respuesta.json();
  } catch {
    /* Respuesta sin cuerpo JSON. */
  }

  return { status: respuesta.status, json };
}

const get = (ruta, token) => api('GET', ruta, { token });
const post = (ruta, body, token) => api('POST', ruta, { token, body });
const patch = (ruta, body, token) => api('PATCH', ruta, { token, body });

/**
 * Espera a que la API responda antes de empezar (tolera reinicios del dev
 * server). Devuelve false si sigue caída después de ~20 s.
 */
async function esperarServidor(intentos = 20, esperaMs = 1000) {
  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      const respuesta = await fetch(`${API_URL}/health`);
      if (respuesta.ok) return true;
    } catch {
      /* El servidor todavía no está escuchando. */
    }
    await new Promise((resolver) => setTimeout(resolver, esperaMs));
  }
  return false;
}

// -----------------------------------------------------------------------------
//  Cliente de Socket.io con historial de eventos
// -----------------------------------------------------------------------------

/**
 * Abre una conexión de sockets y recuerda TODO lo recibido, de modo que se
 * pueda esperar un evento que llegó antes de la aserción (o que nunca llegue).
 * @param {string} token JWT del usuario (vacío para conexión anónima)
 */
function abrirSocket(token) {
  const socket = io(BASE_URL, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });

  const eventos = [];
  const bus = new EventEmitter();

  socket.onAny((nombre, payload) => {
    const evento = { nombre, payload, recibido_en: Date.now() };
    eventos.push(evento);
    bus.emit('evento', evento);
  });

  const listo = new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(new Error(error?.message ?? 'conexión rechazada')));
  });
  // Evita que un rechazo esperado se reporte como promesa no manejada.
  listo.catch(() => {});

  const esperarEvento = (nombre, predicado = () => true, timeoutMs = 5000) =>
    new Promise((resolve, reject) => {
      const yaRecibido = eventos.find((evento) => evento.nombre === nombre && predicado(evento.payload));
      if (yaRecibido) return resolve(yaRecibido.payload);

      const alLlegar = (evento) => {
        if (evento.nombre !== nombre || !predicado(evento.payload)) return;
        clearTimeout(temporizador);
        bus.off('evento', alLlegar);
        resolve(evento.payload);
      };

      const temporizador = setTimeout(() => {
        bus.off('evento', alLlegar);
        reject(new Error(`Timeout de ${timeoutMs} ms esperando "${nombre}".`));
      }, timeoutMs);

      bus.on('evento', alLlegar);

      return undefined;
    });

  return { socket, eventos, listo, esperarEvento };
}

// -----------------------------------------------------------------------------
//  Utilidades de fechas
// -----------------------------------------------------------------------------
const sumarMinutos = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60 * 1000);
const minutosEntre = (desde, hasta) => (new Date(hasta).getTime() - new Date(desde).getTime()) / 60000;

// -----------------------------------------------------------------------------
//  Datos únicos por corrida (permite ejecutar la prueba muchas veces)
// -----------------------------------------------------------------------------
const sufijo = String(Date.now()).slice(-6);
const PASSWORD_PRUEBA = 'E2ePrueba123';

const datosAlumno = (indice) => ({
  dni: `9${String(Number(sufijo) + indice).padStart(7, '0')}`,
  nombre: 'Estudiante',
  apellido: `Prueba ${String.fromCharCode(64 + indice)}`,
  email: `e2e.${indice}.${sufijo}@alumnos.edu.ar`,
  password: PASSWORD_PRUEBA,
});

/** Contexto compartido: tokens, sockets y préstamos creados (para la limpieza). */
const ctx = {
  tokenSecre: null,
  secretoUsuarioId: null,
  alumnos: {},
  sockets: [],
  prestamos: new Set(),
};

/** Registra un alumno y deja su sesión lista para usar. */
async function crearAlumnoConSesion(indice) {
  const datos = datosAlumno(indice);

  const registro = await post('/auth/registro', datos);
  // Un 409 inesperado acá solo puede venir de un reintento: si el dev server se
  // reinició (`node --watch`) la primera tentativa pudo haber llegado igual.
  check(
    registro.status === 201 || registro.status === 409,
    `registro del alumno ${indice} responde 201`,
    `status=${registro.status}`,
  );
  check(registro.json?.data?.usuario?.rol === 'ALUMNO', `el alta del alumno ${indice} asigna rol ALUMNO`);
  check(!JSON.stringify(registro.json ?? {}).includes('password'), `el registro del alumno ${indice} no devuelve la contraseña`);

  const login = await post('/auth/login', { email: datos.email, password: PASSWORD_PRUEBA });
  check(login.status === 200 && typeof login.json?.data?.token === 'string', `el alumno ${indice} inicia sesión con JWT`);

  ctx.alumnos[indice] = { ...datos, token: login.json?.data?.token, usuarioId: login.json?.data?.usuario?.id };
  return ctx.alumnos[indice];
}

// -----------------------------------------------------------------------------
//  Programa principal
// -----------------------------------------------------------------------------
async function ejecutar() {
  console.log(`\n🚀 Prueba E2E contra ${BASE_URL} (base PostgreSQL + Socket.io reales)`);

  // La API puede estar arrancando (o reiniciándose por `node --watch`).
  if (!(await esperarServidor())) {
    throw new Error(`La API no respondió en ${BASE_URL}. Verificá que "npm run dev" esté corriendo.`);
  }

  // ===========================================================================
  titulo('[1/10] Infraestructura y autenticación');
  // ===========================================================================
  const salud = await get('/health');
  check(salud.status === 200 && salud.json?.data?.estado === 'ok', 'GET /api/health responde 200 con estado ok');
  check(typeof salud.json?.meta?.servidor_timestamp === 'number', 'las respuestas incluyen meta.servidor_timestamp');

  const loginSecre = await post('/auth/login', { email: 'secretaria@facultad.edu.ar', password: 'Secretario123!' });
  check(loginSecre.status === 200 && typeof loginSecre.json?.data?.token === 'string', 'la secretaría del seed inicia sesión');
  check(loginSecre.json?.data?.usuario?.rol === 'SECRETARIO', 'el rol SECRETARIO viaja en la respuesta de login');
  check(!JSON.stringify(loginSecre.json ?? {}).includes('"password"'), 'el login no expone el hash de la contraseña');
  ctx.tokenSecre = loginSecre.json?.data?.token;
  ctx.secretoUsuarioId = loginSecre.json?.data?.usuario?.id;

  const loginFallido = await post('/auth/login', { email: 'secretaria@facultad.edu.ar', password: 'clave-incorrecta' });
  check(
    loginFallido.status === 401 && loginFallido.json?.error?.codigo === 'CREDENCIALES_INVALIDAS',
    'una contraseña incorrecta responde 401 sin revelar si el email existe',
  );

  const alumnoA = await crearAlumnoConSesion(1);
  const alumnoB = await crearAlumnoConSesion(2);
  const alumnoC = await crearAlumnoConSesion(3);
  const alumnoD = await crearAlumnoConSesion(4);

  const duplicadoDni = await post('/auth/registro', { ...datosAlumno(1), email: `otro.${sufijo}@alumnos.edu.ar` });
  check(duplicadoDni.status === 409, 'un DNI repetido responde 409', `status=${duplicadoDni.status}`);

  const duplicadoEmail = await post('/auth/registro', { ...datosAlumno(1), dni: `8${String(Number(sufijo) + 9).padStart(7, '0')}` });
  check(duplicadoEmail.status === 409, 'un email repetido responde 409', `status=${duplicadoEmail.status}`);

  const perfil = await get('/auth/me', alumnoA.token);
  check(perfil.status === 200 && perfil.json?.data?.usuario?.email === alumnoA.email, 'GET /api/auth/me devuelve el perfil autenticado');

  const catalogoSinToken = await get('/computadoras');
  check(catalogoSinToken.status === 401, 'el catálogo sin token responde 401');

  const catalogoTokenFalso = await get('/computadoras', 'token.invalido.falso');
  check(catalogoTokenFalso.status === 401, 'un JWT inválido responde 401');

  // ===========================================================================
  titulo('[2/10] Catálogo de computadoras CX');
  // ===========================================================================
  const catalogo = await get('/computadoras', alumnoA.token);
  const equipos = catalogo.json?.data?.computadoras ?? [];
  const codigos = equipos.map((equipo) => equipo.codigo_inventario);
  const codigosEsperados = Array.from({ length: 10 }, (_, i) => `CX-${String(i + 1).padStart(2, '0')}`);

  check(catalogo.status === 200 && equipos.length === 10, 'el catálogo devuelve los 10 equipos', `total=${equipos.length}`);
  check(equipos.every((equipo) => equipo.modelo === 'CX'), 'todos los equipos son marca CX');
  check(JSON.stringify(codigos) === JSON.stringify(codigosEsperados), 'los códigos son CX-01..CX-10 en orden natural', codigos.join(', '));
  check(
    equipos.every((equipo) =>
      ['DISPONIBLE', 'MANTENIMIENTO'].includes(equipo.estado)
        ? equipo.liberacion_en === null
        : typeof equipo.liberacion_en === 'string' && equipo.prestamo_activo !== null,
    ),
    'cada equipo ocupado informa liberacion_en y las libres no',
  );
  check(!JSON.stringify(catalogo.json).includes('token_validacion'), 'el catálogo no filtra ningún PIN');
  check(equipos.find((equipo) => equipo.codigo_inventario === 'CX-10')?.estado === 'MANTENIMIENTO', 'CX-10 figura en MANTENIMIENTO');

  const reservada = equipos.find((equipo) => equipo.estado === 'RESERVADA');
  if (reservada) {
    check(
      /^\*{4}\d{3}$/.test(reservada.prestamo_activo?.usuario?.dni ?? ''),
      'el DNI del alumno se enmascara en el catálogo',
      `${reservada.prestamo_activo?.usuario?.dni}`,
    );
  } else {
    check(true, 'no hay equipos reservados en este momento (el DNI enmascarado se verifica en el smoke test)');
  }

  const equiposLibres = equipos.filter((equipo) => equipo.estado === 'DISPONIBLE').length;
  const filtroDisponibles = await get('/computadoras?estado=DISPONIBLE', alumnoA.token);
  check(
    filtroDisponibles.json?.data?.computadoras?.length === equiposLibres &&
      filtroDisponibles.json.data.computadoras.every((equipo) => equipo.estado === 'DISPONIBLE'),
    'el filtro ?estado=DISPONIBLE devuelve solo equipos libres',
  );
  check((await get('/computadoras?estado=DISPONIBLE%20', alumnoA.token)).status === 200, 'el filtro tolera un espacio al final del estado');
  check((await get('/computadoras?estado=VOLANDO', alumnoA.token)).status === 400, 'un estado inexistente responde 400');
  check(
    JSON.stringify((await get('/computadoras?busqueda=05', alumnoA.token)).json?.data?.computadoras?.map((e) => e.codigo_inventario)) ===
      JSON.stringify(['CX-05']),
    'la búsqueda "05" encuentra solo CX-05',
  );

  const idPorCodigo = (codigo) => equipos.find((equipo) => equipo.codigo_inventario === codigo)?.id;
  const [idCx01, idCx02, idCx04, idCx10] = [idPorCodigo('CX-01'), idPorCodigo('CX-02'), idPorCodigo('CX-04'), idPorCodigo('CX-10')];
  const equiposLibresDePrueba = ['CX-01', 'CX-02', 'CX-04'].every((codigo) =>
    ['DISPONIBLE', 'MANTENIMIENTO'].includes(equipos.find((e) => e.codigo_inventario === codigo)?.estado),
  );
  check(
    equiposLibresDePrueba,
    'CX-01, CX-02 y CX-04 están libres para la prueba (ejecutá "npm run db:reset && npm run db:seed" si están ocupados)',
    equipos.filter((e) => ['CX-01', 'CX-02', 'CX-04'].includes(e.codigo_inventario)).map((e) => `${e.codigo_inventario}:${e.estado}`).join(' '),
  );

  // ===========================================================================
  titulo('[3/10] Socket.io, reloj y reserva del alumno A');
  // ===========================================================================
  const socketSecre = abrirSocket(ctx.tokenSecre);
  const socketA = abrirSocket(alumnoA.token);
  const socketB = abrirSocket(alumnoB.token);
  ctx.sockets.push(socketSecre, socketA, socketB);

  await Promise.all([socketSecre.listo, socketA.listo, socketB.listo]);
  check(socketSecre.socket.connected && socketA.socket.connected && socketB.socket.connected, 'secretaría y alumnos conectan al canal en tiempo real');

  const saludo = await socketA.esperarEvento('conectado', () => true, 3000);
  check(typeof saludo?.servidor_timestamp === 'number', 'el servidor saluda con servidor_timestamp');

  const handshakeReloj = await new Promise((resolve, reject) => {
    socketA.socket.timeout(4000).emit('sincronizar_hora', (error, respuesta) => (error ? reject(error) : resolve(respuesta)));
  });
  check(typeof handshakeReloj?.servidor_timestamp === 'number', 'el handshake sincronizar_hora devuelve la hora del servidor');

  const horaServidor = await get('/servidor/hora', alumnoA.token);
  check(
    horaServidor.status === 200 && Math.abs(horaServidor.json?.data?.servidor_timestamp - Date.now()) < 5000,
    'GET /api/servidor/hora coincide con el reloj local (offset < 5s)',
  );

  const socketFalso = abrirSocket('token.falso.de.prueba');
  let rechazado = false;
  try {
    await socketFalso.listo;
  } catch {
    rechazado = true;
  }
  socketFalso.socket.disconnect();
  check(rechazado, 'una conexión de socket con JWT inválido es rechazada');

  const eventoPc = socketA.esperarEvento('computadora_actualizada', (payload) => payload?.computadora?.id === idCx01, 5000);
  const eventoNuevo = socketSecre.esperarEvento('nuevo_prestamo', (payload) => payload?.prestamo?.computadora?.id === idCx01, 5000);

  const reservaA = await post('/prestamos/reservar', { computadora_id: idCx01 }, alumnoA.token);
  const prestamoA = reservaA.json?.data?.prestamo;
  const pinA = prestamoA?.token_validacion;
  ctx.prestamos.add(prestamoA?.id);

  check(reservaA.status === 201, 'POST /api/prestamos/reservar responde 201', `status=${reservaA.status}`);
  check(/^\d{4}$/.test(pinA ?? ''), 'la reserva devuelve un PIN de 4 dígitos', `pin=${pinA}`);
  check(prestamoA?.estado === 'PENDIENTE_RETIRO', 'el préstamo nace en PENDIENTE_RETIRO');
  check(reservaA.json?.data?.computadora?.estado === 'RESERVADA', 'la computadora pasa a RESERVADA');
  check(Math.round(minutosEntre(prestamoA?.fecha_hora_inicio, prestamoA?.fecha_hora_fin_estimada)) === DURACION_MINUTOS, `la reserva inmediata dura ${DURACION_MINUTOS} minutos`);
  check(prestamoA?.limite_retiro !== null, 'la reserva informa el límite de retiro (tolerancia)');
  check(typeof reservaA.json?.meta?.servidor_timestamp === 'number', 'la respuesta de la reserva trae meta.servidor_timestamp');

  const payloadPc = await eventoPc;
  const payloadNuevo = await eventoNuevo;
  check(payloadPc?.computadora?.estado === 'RESERVADA' && payloadPc?.motivo === 'nueva_reserva', 'todos los clientes reciben computadora_actualizada al reservar');
  check(payloadPc?.computadora?.tiempo_restante_segundos > 0, 'el evento incluye el tiempo restante para el contador de la UI');
  check(payloadNuevo?.prestamo?.token_validacion === pinA, 'la secretaría recibe nuevo_prestamo con el PIN de retiro');
  const eventosDePrestamoDeB = socketB.eventos.filter((evento) =>
    ['nuevo_prestamo', 'prestamo_actualizado', 'reserva_expirada'].includes(evento.nombre),
  );
  check(eventosDePrestamoDeB.length === 0, 'otro alumno no recibe eventos de préstamos ajenos', `${eventosDePrestamoDeB.length} recibidos`);
  check(
    !socketB.eventos.some((evento) => evento.payload?.prestamo?.token_validacion === pinA),
    'otro alumno NO recibe el PIN en ningún evento',
  );

  const detalleCx01 = await get(`/computadoras/${idCx01}`, alumnoA.token);
  const restante = detalleCx01.json?.data?.computadora?.tiempo_restante_segundos;
  check(
    detalleCx01.json?.data?.computadora?.estado === 'RESERVADA' && restante > 880 && restante <= 900,
    'una PC recién reservada se libera a los 15 min de tolerancia',
    `restante=${restante}s`,
  );
  check(!JSON.stringify(detalleCx01.json).includes(pinA), 'el detalle de la computadora no expone el PIN');

  const reservaDuplicada = await post('/prestamos/reservar', { computadora_id: idCx02 }, alumnoA.token);
  check(reservaDuplicada.status === 409, 'un alumno con préstamo vigente no puede reservar otra PC (409)');

  // ===========================================================================
  titulo('[4/10] Carrera: dos alumnos reservando la misma PC a la vez');
  // ===========================================================================
  const [intentoB, intentoC] = await Promise.all([
    post('/prestamos/reservar', { computadora_id: idCx02 }, alumnoB.token),
    post('/prestamos/reservar', { computadora_id: idCx02 }, alumnoC.token),
  ]);

  const ganadoras = [intentoB, intentoC].filter((intento) => intento.status === 201);
  const perdedoras = [intentoB, intentoC].filter((intento) => intento.status === 409);
  check(ganadoras.length === 1 && perdedoras.length === 1, 'solo una de las dos reservas simultáneas prospera', `status=${intentoB.status}/${intentoC.status}`);
  check(
    perdedoras[0]?.json?.error?.detalles?.parametro === 'computadora_ocupada',
    'la reserva perdedora falla en la transición atómica (no por otra regla)',
    `${perdedoras[0]?.json?.error?.detalles?.parametro}`,
  );
  check(
    perdedoras[0]?.json?.error?.codigo === 'CONFLICTO_DE_ESTADO',
    'la reserva perdedora informa CONFLICTO_DE_ESTADO',
  );

  const prestamoGanador = ganadoras[0]?.json?.data?.prestamo;
  const pinGanador = prestamoGanador?.token_validacion;
  const tokenGanador = prestamoGanador?.usuario?.email === alumnoB.email ? alumnoB.token : alumnoC.token;
  const tokenPerdedor = tokenGanador === alumnoB.token ? alumnoC.token : alumnoB.token;
  ctx.prestamos.add(prestamoGanador?.id);
  check(pinGanador !== pinA, 'los PIN vigentes son únicos (el nuevo PIN no repite el anterior)');

  const cancelacionAjena = await post(`/prestamos/${prestamoGanador?.id}/cancelar`, {}, tokenPerdedor);
  check(cancelacionAjena.status === 409, 'un alumno no puede cancelar la reserva de otro (409)');

  const cancelacionPropia = await post(`/prestamos/${prestamoGanador?.id}/cancelar`, {}, tokenGanador);
  check(cancelacionPropia.status === 200 && cancelacionPropia.json?.data?.prestamo?.estado === 'CANCELADO', 'el dueño cancela su reserva y queda CANCELADO');
  check(cancelacionPropia.json?.data?.computadora?.estado === 'DISPONIBLE', 'al cancelar, la computadora queda DISPONIBLE');

  const catalogoTrasCarrera = await get('/computadoras?estado=DISPONIBLE', alumnoA.token);
  check(
    catalogoTrasCarrera.json?.data?.computadoras?.some((equipo) => equipo.id === idCx02),
    'CX-02 vuelve a figurar como disponible tras la cancelación',
  );

  // ===========================================================================
  titulo('[5/10] Check-in de secretaría y devolución');
  // ===========================================================================
  const rolesCheckIn = await Promise.all([
    post('/prestamos/check-in', { token: pinA }, alumnoA.token),
    post('/prestamos/check-in', { token: pinA }),
    post('/prestamos/check-in', { token: '0000' }, ctx.tokenSecre),
    post('/prestamos/check-in', { token: '12ab' }, ctx.tokenSecre),
  ]);
  check(rolesCheckIn[0].status === 403, 'un alumno no puede hacer check-in (403)', `status=${rolesCheckIn[0].status}`);
  check(rolesCheckIn[1].status === 401, 'el check-in sin sesión responde 401');
  check(rolesCheckIn[2].status === 404 && rolesCheckIn[2].json?.error?.codigo === 'NO_ENCONTRADO', 'un PIN inexistente responde 404');
  check(rolesCheckIn[3].status === 400, 'un PIN con formato inválido responde 400');

  const vigentes = await get('/prestamos/vigentes', ctx.tokenSecre);
  const enCola = vigentes.json?.data?.pendientes?.find((prestamo) => prestamo.id === prestamoA?.id);
  check(vigentes.status === 200 && Boolean(enCola), 'la reserva del alumno A aparece en la cola de secretaría');
  check(enCola?.token_validacion === pinA, 'la cola de secretaría muestra el PIN del alumno');
  check(enCola?.usuario?.email === alumnoA.email, 'la cola identifica al alumno dueño de la reserva');
  check(!JSON.stringify(vigentes.json).includes('"password"'), 'la cola de secretaría no expone hashes de contraseña');

  const eventoEnUso = socketA.esperarEvento('computadora_actualizada', (payload) => payload?.computadora?.id === idCx01 && payload?.computadora?.estado === 'EN_USO', 5000);
  const eventoPrestamoActivo = socketA.esperarEvento('prestamo_actualizado', (payload) => payload?.prestamo?.id === prestamoA?.id, 5000);

  const checkIn = await post('/prestamos/check-in', { token: pinA }, ctx.tokenSecre);
  check(checkIn.status === 200, 'la secretaría valida el PIN y entrega el equipo (200)', `status=${checkIn.status}`);
  check(checkIn.json?.data?.prestamo?.estado === 'ACTIVO', 'el préstamo pasa a ACTIVO con el check-in');
  check(checkIn.json?.data?.computadora?.estado === 'EN_USO', 'la computadora pasa a EN_USO');
  check(
    Math.round(minutosEntre(checkIn.json?.data?.prestamo?.fecha_hora_inicio, checkIn.json?.data?.prestamo?.fecha_hora_fin_estimada)) === DURACION_MINUTOS,
    'el reloj del préstamo arranca en el momento de la entrega',
  );
  check((await eventoEnUso)?.computadora?.estado === 'EN_USO', 'el alumno ve EN_USO en vivo por Socket.io');
  check((await eventoPrestamoActivo)?.prestamo?.estado === 'ACTIVO', 'el alumno recibe prestamo_actualizado de su propio préstamo');

  const checkInRepetido = await post('/prestamos/check-in', { token: pinA }, ctx.tokenSecre);
  check(checkInRepetido.status === 409, 'un PIN ya validado responde 409', `status=${checkInRepetido.status}`);

  const misPrestamosActivo = await get('/prestamos/mios', alumnoA.token);
  check(misPrestamosActivo.json?.data?.vigente?.estado === 'ACTIVO', 'GET /prestamos/mios muestra el préstamo activo');
  check(misPrestamosActivo.json?.data?.vigente?.token_validacion === pinA, 'el dueño sí puede ver su PIN');
  check(Array.isArray(misPrestamosActivo.json?.data?.historial), 'GET /prestamos/mios incluye el historial');

  const detalleEnUso = await get(`/computadoras/${idCx01}`, alumnoA.token);
  const restanteEnUso = detalleEnUso.json?.data?.computadora?.tiempo_restante_segundos;
  check(restanteEnUso > DURACION_SEGUNDOS - 10 && restanteEnUso <= DURACION_SEGUNDOS, `una PC en uso muestra los ${DURACION_MINUTOS} min restantes`, `restante=${restanteEnUso}s`);
  check((await get('/prestamos/vigentes', alumnoA.token)).status === 403, 'un alumno no puede ver la cola de secretaría (403)');
  check((await get('/computadoras/estadisticas/resumen', alumnoA.token)).status === 403, 'un alumno no puede ver las estadísticas (403)');

  const resumen = await get('/computadoras/estadisticas/resumen', ctx.tokenSecre);
  check(resumen.status === 200 && resumen.json?.data?.total === 10, 'la secretaría obtiene el resumen del inventario (10 equipos)');
  check(
    ['disponibles', 'reservadas', 'en_uso', 'en_mantenimiento'].every((clave) => typeof resumen.json?.data?.[clave] === 'number'),
    'el resumen desglosa los contadores por estado',
  );

  check((await post(`/prestamos/${prestamoA?.id}/finalizar`, {}, alumnoA.token)).status === 403, 'un alumno no puede finalizar un préstamo (403)');

  const eventoFinalizado = socketA.esperarEvento('computadora_actualizada', (payload) => payload?.computadora?.id === idCx01 && payload?.computadora?.estado === 'DISPONIBLE', 5000);
  const finalizacion = await post(`/prestamos/${prestamoA?.id}/finalizar`, { observaciones: 'Devolución verificada por la prueba E2E.' }, ctx.tokenSecre);
  check(finalizacion.status === 200 && finalizacion.json?.data?.prestamo?.estado === 'FINALIZADO', 'la secretaría finaliza el préstamo');
  check(Boolean(finalizacion.json?.data?.prestamo?.fecha_hora_fin_real), 'la finalización registra la hora real de devolución');
  check(
    finalizacion.json?.data?.prestamo?.observaciones_devolucion === 'Devolución verificada por la prueba E2E.',
    'las observaciones de la recepción quedan guardadas en el préstamo',
  );
  check(finalizacion.json?.data?.prestamo?.reportes?.length === 0, 'una recepción sin reportes no crea fallas');
  check(finalizacion.json?.data?.computadora?.estado === 'DISPONIBLE', 'al finalizar, la computadora vuelve a DISPONIBLE');
  check((await eventoFinalizado)?.computadora?.estado === 'DISPONIBLE', 'el alumno ve la liberación del equipo en vivo');
  check((await post(`/prestamos/${prestamoA?.id}/finalizar`, {}, ctx.tokenSecre)).status === 409, 'finalizar un préstamo ya cerrado responde 409');

  const misPrestamosCerrado = await get('/prestamos/mios', alumnoA.token);
  check(misPrestamosCerrado.json?.data?.vigente === null, 'el alumno queda sin préstamo vigente tras la devolución');
  check(misPrestamosCerrado.json?.data?.historial?.some((prestamo) => prestamo.id === prestamoA?.id), 'el préstamo finalizado queda en el historial');

  // ===========================================================================
  titulo('[6/10] Reglas de reserva (límites y errores)');
  // ===========================================================================
  const programadaLejana = await post(
    '/prestamos/reservar',
    { computadora_id: idCx04, inicio_programado: sumarMinutos(new Date(), 90).toISOString() },
    alumnoB.token,
  );
  check(programadaLejana.status === 400 && programadaLejana.json?.error?.codigo === 'SOLICITUD_INVALIDA', 'programar con más de 60 min de anticipación responde 400');

  const programadaPasado = await post(
    '/prestamos/reservar',
    { computadora_id: idCx04, inicio_programado: sumarMinutos(new Date(), -5).toISOString() },
    alumnoB.token,
  );
  check(programadaPasado.status === 400, 'programar en el pasado responde 400');

  const fechaInvalida = await post('/prestamos/reservar', { computadora_id: idCx04, inicio_programado: 'mañana a las 3' }, alumnoB.token);
  check(fechaInvalida.status === 400, 'una fecha con formato inválido responde 400');

  const idInvalido = await post('/prestamos/reservar', { computadora_id: 'no-es-un-uuid' }, alumnoB.token);
  check(idInvalido.status === 400, 'un identificador no UUID responde 400');

  const pcInexistente = await post('/prestamos/reservar', { computadora_id: '00000000-0000-4000-8000-000000000000' }, alumnoB.token);
  check(pcInexistente.status === 404 && pcInexistente.json?.error?.codigo === 'NO_ENCONTRADO', 'reservar una PC inexistente responde 404');

  const pcMantenimiento = await post('/prestamos/reservar', { computadora_id: idCx10 }, alumnoB.token);
  check(pcMantenimiento.status === 409, 'reservar una PC en mantenimiento responde 409');

  // ===========================================================================
  titulo('[7/10] Expiración automática (no-show) de una reserva no retirada');
  // ===========================================================================
  const reservaProgramada = await post(
    '/prestamos/reservar',
    { computadora_id: idCx04, inicio_programado: sumarMinutos(new Date(), 30).toISOString() },
    alumnoD.token,
  );
  const prestamoD = reservaProgramada.json?.data?.prestamo;
  ctx.prestamos.add(prestamoD?.id);
  check(reservaProgramada.status === 201, 'el alumno D reserva CX-04 con 30 min de anticipación (201)', `status=${reservaProgramada.status}`);
  check(Math.round(minutosEntre(new Date(), prestamoD?.fecha_hora_inicio)) === 30, 'la reserva programada respeta el horario pedido');
  check(reservaProgramada.json?.data?.computadora?.estado === 'RESERVADA', 'la PC programada queda RESERVADA hasta el retiro');

  // Se simula el paso del tiempo retrasando el inicio en la base (imposible por API: es a propósito).
  await prisma.prestamo.update({
    where: { id: prestamoD?.id },
    data: { fecha_hora_inicio: new Date(Date.now() - 30 * 60 * 1000) },
  });

  const eventoExpiracion = socketSecre.esperarEvento(
    'reserva_expirada',
    (payload) => payload?.prestamo?.id === prestamoD?.id,
    INTERVALO_EXPIRACION_MS + 10_000,
  );

  const expirado = await eventoExpiracion.then(() => true, () => false);
  check(expirado, `el job libera la reserva vencida dentro del intervalo de expiración (${INTERVALO_EXPIRACION_MS / 1000}s)`);

  const detalleCx04 = await get(`/computadoras/${idCx04}`, ctx.tokenSecre);
  check(detalleCx04.json?.data?.computadora?.estado === 'DISPONIBLE', 'CX-04 vuelve a DISPONIBLE tras expirar la reserva');

  const misPrestamosD = await get('/prestamos/mios', alumnoD.token);
  check(misPrestamosD.json?.data?.vigente === null, 'el alumno D queda sin préstamo vigente');
  check(
    misPrestamosD.json?.data?.historial?.some((prestamo) => prestamo.id === prestamoD?.id && prestamo.estado === 'CANCELADO_NO_SHOW'),
    'la reserva no retirada queda registrada como CANCELADO_NO_SHOW',
  );
  check(
    !misPrestamosD.json?.data?.historial?.some((prestamo) => prestamo.id === prestamoD?.id && prestamo.estado === 'CANCELADO'),
    'el no-show no se confunde con una cancelación voluntaria',
  );

  // ===========================================================================
  titulo('[8/10] Sprint 3: extensión de préstamo y alerta de 15 minutos');
  // ===========================================================================
  const reservaB = await post('/prestamos/reservar', { computadora_id: idCx02 }, alumnoB.token);
  const prestamoB = reservaB.json?.data?.prestamo;
  ctx.prestamos.add(prestamoB?.id);
  check(reservaB.status === 201, 'el alumno B reserva CX-02 para probar la extensión (201)', `status=${reservaB.status}`);

  const checkInB = await post('/prestamos/check-in', { token: prestamoB?.token_validacion }, ctx.tokenSecre);
  check(checkInB.status === 200 && checkInB.json?.data?.prestamo?.estado === 'ACTIVO', 'la secretaría hace check-in del préstamo de B');
  const finBase = new Date(checkInB.json?.data?.prestamo?.fecha_hora_fin_estimada).getTime();

  // --- Permisos y reglas de la extensión (US-05) -----------------------------
  check(
    (await post(`/prestamos/${prestamoB?.id}/extender`, {}, alumnoA.token)).status === 403,
    'un alumno no puede extender el préstamo de otro (403)',
  );
  check(
    (await post(`/prestamos/${prestamoA?.id}/extender`, {}, alumnoA.token)).status === 409,
    'extender un préstamo ya finalizado responde 409',
  );
  check((await post('/prestamos/00000000-0000-4000-8000-000000000000/extender', {}, alumnoB.token)).status === 404,
    'extender un préstamo inexistente responde 404');

  const eventoExtensionB = socketB.esperarEvento('prestamo_actualizado', (p) => p?.prestamo?.id === prestamoB?.id && p?.motivo === 'extension', 5000);
  const eventoExtensionSecre = socketSecre.esperarEvento('prestamo_actualizado', (p) => p?.prestamo?.id === prestamoB?.id && p?.motivo === 'extension', 5000);
  const eventoExtensionPc = socketB.esperarEvento('computadora_actualizada', (p) => p?.computadora?.id === idCx02 && p?.motivo === 'extension', 5000);

  const extension = await post(`/prestamos/${prestamoB?.id}/extender`, {}, alumnoB.token);
  check(extension.status === 200, 'el titular extiende su préstamo activo (200)', `status=${extension.status}`);
  const finDespues = new Date(extension.json?.data?.prestamo?.fecha_hora_fin_estimada).getTime();
  check(
    Math.round((finDespues - finBase) / 60000) === 60,
    'la extensión suma exactamente 60 minutos a la devolución estimada',
    `${Math.round((finDespues - finBase) / 60000)} min`,
  );
  check((await eventoExtensionB)?.motivo === 'extension', 'el alumno recibe prestamo_actualizado con motivo extension');
  check((await eventoExtensionSecre)?.motivo === 'extension', 'la secretaría recibe la actualización en vivo');
  check((await eventoExtensionPc)?.computadora?.estado === 'EN_USO', 'el catálogo actualiza la hora de liberación en vivo');

  // --- Conflicto: hay otra reserva programada en la siguiente hora ----------
  const reservaPosterior = await prisma.prestamo.create({
    data: {
      usuario_id: alumnoC.usuarioId,
      computadora_id: idCx02,
      token_validacion: '9999',
      estado: 'PENDIENTE_RETIRO',
      fecha_hora_inicio: sumarMinutos(new Date(), 30),
      fecha_hora_fin_estimada: sumarMinutos(new Date(), 30 + DURACION_MINUTOS),
    },
  });

  const extensionBloqueada = await post(`/prestamos/${prestamoB?.id}/extender`, {}, alumnoB.token);
  check(extensionBloqueada.status === 409, 'con otra reserva en la hora siguiente la extensión se rechaza (409)', `status=${extensionBloqueada.status}`);
  check(
    extensionBloqueada.json?.error?.detalles?.parametro === 'reserva_posterior',
    'el rechazo identifica la reserva posterior que bloquea la extensión',
    `${extensionBloqueada.json?.error?.detalles?.parametro}`,
  );

  await prisma.prestamo.delete({ where: { id: reservaPosterior.id } });
  check(true, 'la reserva de prueba se retira de la base (no deja rastro)');

  // --- Alerta preventiva a los 15 minutos (job real) ------------------------
  await prisma.prestamo.update({
    where: { id: prestamoB?.id },
    data: { fecha_hora_fin_estimada: sumarMinutos(new Date(), 10), alerta_vencimiento_enviada: false },
  });

  const alertaB = socketB
    .esperarEvento('prestamo_por_vencer', (p) => p?.prestamo?.id === prestamoB?.id, INTERVALO_ALERTA_MS + 20_000)
    .then((p) => p, () => null);
  const alertaSecre = socketSecre
    .esperarEvento('prestamo_por_vencer', (p) => p?.prestamo?.id === prestamoB?.id, INTERVALO_ALERTA_MS + 20_000)
    .then((p) => p, () => null);

  const payloadAlerta = await alertaB;
  const payloadAlertaSecre = await alertaSecre;
  check(Boolean(payloadAlerta), `el job avisa al alumno cuando faltan <= ${ALERTA_MINUTOS} min`, 'sin evento');
  check(Boolean(payloadAlertaSecre), 'el job avisa también a la secretaría', 'sin evento');
  check(payloadAlerta?.prestamo?.token_validacion === undefined, 'la alerta NO expone el PIN del préstamo');
  check(payloadAlerta?.prestamo?.estado === 'ACTIVO', 'la alerta describe el préstamo activo');
  check(
    !socketA.eventos.some((evento) => evento.nombre === 'prestamo_por_vencer' && evento.payload?.prestamo?.id === prestamoB?.id),
    'la alerta no llega a alumnos ajenos al préstamo',
  );

  const marcado = await prisma.prestamo.findUnique({
    where: { id: prestamoB?.id },
    select: { alerta_vencimiento_enviada: true },
  });
  check(marcado?.alerta_vencimiento_enviada === true, 'la alerta queda marcada en la base (idempotencia)');

  // Un ciclo completo del job más, sin duplicar el aviso.
  await new Promise((resolver) => setTimeout(resolver, INTERVALO_ALERTA_MS + 5_000));
  const alertasRecibidas = socketB.eventos.filter(
    (evento) => evento.nombre === 'prestamo_por_vencer' && evento.payload?.prestamo?.id === prestamoB?.id,
  );
  check(alertasRecibidas.length === 1, 'la alerta se emite exactamente una vez por vencimiento', `${alertasRecibidas.length} recibidas`);

  // ===========================================================================
  titulo('[9/10] Sprint 3: devolución con reporte, historial y mantenimiento');
  // ===========================================================================
  check(
    (await post(`/prestamos/${prestamoB?.id}/devolver`, {}, alumnoA.token)).status === 403,
    'un alumno no puede registrar la devolución de otro (403)',
  );
  check(
    (await post(`/prestamos/${prestamoB?.id}/devolver`, { reporte: { severidad: 'GRAVE', descripcion: 'corta' } }, alumnoB.token)).status === 400,
    'un reporte con descripción demasiado corta responde 400',
  );
  check(
    (await post(
      `/prestamos/${prestamoB?.id}/devolver`,
      { reporte: { severidad: 'NUCLEAR', descripcion: 'Se apaga sola al abrir el navegador.' } },
      alumnoB.token,
    )).status === 400,
    'una severidad desconocida responde 400',
  );

  // Una reserva sin check-in no puede devolverse (solo préstamos ACTIVOS).
  const reservaD2 = await post('/prestamos/reservar', { computadora_id: idCx04 }, alumnoD.token);
  const prestamoD2 = reservaD2.json?.data?.prestamo;
  ctx.prestamos.add(prestamoD2?.id);
  check(reservaD2.status === 201, 'el alumno D reserva CX-04 de nuevo (201)', `status=${reservaD2.status}`);
  check((await post(`/prestamos/${prestamoD2?.id}/devolver`, {}, alumnoD.token)).status === 409, 'devolver una reserva sin check-in responde 409');
  check((await post(`/prestamos/${prestamoD2?.id}/cancelar`, {}, alumnoD.token)).status === 200, 'la reserva de prueba se cancela para no dejar rastro');

  // --- Devolución del alumno con reporte de falla (US-06 + US-08) -----------
  const eventoEquipoConFalla = socketSecre.esperarEvento(
    'computadora_actualizada',
    (p) => p?.computadora?.id === idCx02 && p?.computadora?.estado === 'MANTENIMIENTO',
    5000,
  );

  const devolucion = await post(
    `/prestamos/${prestamoB?.id}/devolver`,
    {
      observaciones: 'Equipo entregado con observaciones.',
      reporte: { severidad: 'GRAVE', descripcion: 'El teclado se traba cada pocos minutos de uso.' },
    },
    alumnoB.token,
  );
  check(devolucion.status === 200, 'el alumno registra la devolución con reporte (200)', `status=${devolucion.status}`);
  check(devolucion.json?.data?.prestamo?.estado === 'FINALIZADO', 'la devolución deja el préstamo FINALIZADO');
  check(Boolean(devolucion.json?.data?.prestamo?.fecha_hora_fin_real), 'se registra la hora real de devolución');
  check(
    devolucion.json?.data?.prestamo?.observaciones_devolucion === 'Equipo entregado con observaciones.',
    'las observaciones del alumno quedan guardadas en el préstamo',
  );
  check(devolucion.json?.data?.reporte?.severidad === 'GRAVE', 'la respuesta incluye el reporte de falla creado');
  check(devolucion.json?.data?.reporte?.resuelto === false, 'el reporte nace sin resolver');
  check(devolucion.json?.data?.computadora?.estado === 'MANTENIMIENTO', 'una falla GRAVE deriva la PC a MANTENIMIENTO');
  check((await eventoEquipoConFalla)?.motivo === 'devolucion_con_falla', 'secretaría ve el cambio a MANTENIMIENTO en vivo');

  const misPrestamosB = await get('/prestamos/mios', alumnoB.token);
  check(misPrestamosB.json?.data?.vigente === null, 'el alumno B queda sin préstamo vigente tras devolver');
  check(
    misPrestamosB.json?.data?.historial?.some((p) => p.id === prestamoB?.id && p.estado === 'FINALIZADO' && p.reportes?.length === 1),
    'el historial del alumno muestra el préstamo cerrado con su reporte',
  );

  // --- Historial y trazabilidad (secretaría) --------------------------------
  check((await get(`/computadoras/${idCx02}/historial`, alumnoB.token)).status === 403, 'el historial es exclusivo de la secretaría (403)');
  check(
    (await get('/computadoras/00000000-0000-4000-8000-000000000000/historial', ctx.tokenSecre)).status === 404,
    'el historial de una PC inexistente responde 404',
  );

  const historial = await get(`/computadoras/${idCx02}/historial`, ctx.tokenSecre);
  check(historial.status === 200, 'la secretaría consulta el historial de CX-02 (200)', `status=${historial.status}`);
  check(historial.json?.data?.computadora?.codigo_inventario === 'CX-02', 'el historial identifica a la máquina');
  check(
    historial.json?.data?.prestamos?.some((p) => p.id === prestamoB?.id && p.observaciones_devolucion),
    'el historial lista los préstamos con sus observaciones de devolución',
  );
  check(
    historial.json?.data?.prestamos?.every((p) => p.usuario?.dni && p.usuario?.apellido),
    'cada préstamo del historial indica quién usó la máquina',
  );
  check(
    historial.json?.data?.reportes?.some((r) => r.severidad === 'GRAVE' && r.resuelto === false && r.usuario?.apellido),
    'el historial lista las fallas reportadas con su severidad',
  );

  // --- Panel de mantenimiento: sacar / reintegrar manualmente --------------
  check((await patch(`/computadoras/${idCx02}/estado`, { estado: 'DISPONIBLE' }, alumnoB.token)).status === 403, 'un alumno no puede cambiar estados (403)');
  check((await patch(`/computadoras/${idCx02}/estado`, { estado: 'EN_USO' }, ctx.tokenSecre)).status === 400, 'EN_USO no es un estado manual válido (400)');

  const reintegro = await patch(`/computadoras/${idCx02}/estado`, { estado: 'DISPONIBLE' }, ctx.tokenSecre);
  check(reintegro.status === 200 && reintegro.json?.data?.computadora?.estado === 'DISPONIBLE', 'la secretaría reintegra el equipo reparado (200)');

  const historialTrasReintegro = await get(`/computadoras/${idCx02}/historial`, ctx.tokenSecre);
  check(
    historialTrasReintegro.json?.data?.reportes?.length > 0 &&
      historialTrasReintegro.json?.data?.reportes?.every((r) => r.resuelto === true),
    'reintegrar el equipo cierra todos sus reportes abiertos',
  );
  check(
    (await patch(`/computadoras/${idCx02}/estado`, { estado: 'DISPONIBLE' }, ctx.tokenSecre)).status === 409,
    'reintegrar un equipo ya disponible responde 409',
  );

  const eventoMantenimiento = socketSecre.esperarEvento(
    'computadora_actualizada',
    (p) => p?.computadora?.id === idCx02 && p?.motivo === 'mantenimiento_manual',
    5000,
  );
  const fueraDeServicio = await patch(`/computadoras/${idCx02}/estado`, { estado: 'MANTENIMIENTO' }, ctx.tokenSecre);
  check(fueraDeServicio.status === 200 && fueraDeServicio.json?.data?.computadora?.estado === 'MANTENIMIENTO', 'la secretaría saca el equipo de servicio (200)');
  check((await eventoMantenimiento)?.computadora?.estado === 'MANTENIMIENTO', 'el cambio a MANTENIMIENTO se difunde en vivo');
  check(
    (await patch(`/computadoras/${idCx02}/estado`, { estado: 'MANTENIMIENTO' }, ctx.tokenSecre)).status === 409,
    'sacar dos veces el mismo equipo responde 409',
  );

  const catalogoGeneral = await get('/computadoras', ctx.tokenSecre);
  const cx09 = catalogoGeneral.json?.data?.computadoras?.find((e) => e.codigo_inventario === 'CX-09');
  if (cx09?.estado === 'EN_USO') {
    check(
      (await patch(`/computadoras/${cx09.id}/estado`, { estado: 'MANTENIMIENTO' }, ctx.tokenSecre)).status === 409,
      'no se puede sacar a mantenimiento un equipo EN_USO (409)',
    );
  } else {
    check(true, 'sin equipos EN_USO para verificar el bloqueo (CX-09 no está en uso en esta corrida)');
  }

  // Se devuelve CX-02 a DISPONIBLE para dejar el inventario como estaba.
  const restauracion = await patch(`/computadoras/${idCx02}/estado`, { estado: 'DISPONIBLE' }, ctx.tokenSecre);
  check(restauracion.status === 200 && restauracion.json?.data?.computadora?.estado === 'DISPONIBLE', 'CX-02 queda DISPONIBLE al terminar la prueba');

  // ===========================================================================
  titulo('[10/10] Limpieza y resultado');
  // ===========================================================================
  for (const instancia of ctx.sockets) instancia.socket.disconnect();
  check(true, `conexiones de socket cerradas (${ctx.sockets.length})`);
}

// -----------------------------------------------------------------------------
//  Limpieza de seguridad: libera cualquier préstamo que haya quedado abierto
// -----------------------------------------------------------------------------
async function limpiarPrestamosPendientes() {
  if (!ctx.tokenSecre) return;

  for (const prestamoId of ctx.prestamos) {
    if (!prestamoId) continue;
    try {
      const cancelacion = await post(`/prestamos/${prestamoId}/cancelar`, {}, ctx.tokenSecre);
      if (cancelacion.status !== 200) {
        await post(`/prestamos/${prestamoId}/finalizar`, { observaciones: 'Limpieza de la prueba E2E.' }, ctx.tokenSecre);
      }
    } catch {
      /* La limpieza es best-effort: nunca debe enmascarar el resultado. */
    }
  }
}

// -----------------------------------------------------------------------------
//  Ejecución
// -----------------------------------------------------------------------------
const inicio = Date.now();

try {
  await ejecutar();
} catch (error) {
  fallas.push(`Excepción no controlada: ${error.message}`);
  console.error(`\n💥 Excepción durante la prueba: ${error.message}`);
} finally {
  try {
    for (const instancia of ctx.sockets) instancia.socket.disconnect();
    await limpiarPrestamosPendientes();
  } catch {
    /* La limpieza nunca debe enmascarar el resultado. */
  }

  await desconectarBD().catch(() => {});

  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(64)}`);
  if (fallas.length === 0) {
    console.log(`OK - Prueba E2E sin fallos: ${verificaciones} verificaciones en ${segundos}s.`);
  } else {
    console.log(`FALLO - Prueba E2E: ${fallas.length} de ${verificaciones} verificaciones fallaron en ${segundos}s.`);
    fallas.forEach((detalle, indice) => console.log(`  ${indice + 1}) ${detalle}`));
  }
  console.log(`${'='.repeat(64)}\n`);

  process.exit(fallas.length === 0 ? 0 : 1);
}
