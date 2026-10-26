/**
 * =============================================================================
 *  Prueba de humo del backend (NO requiere base de datos)
 * =============================================================================
 *  Verifica de punta a punta todo lo que no depende de PostgreSQL:
 *
 *   1. Que TODOS los módulos del backend se importen sin errores.
 *   2. Que el pipeline Express responda con el contrato correcto
 *      (health, 404, 400 de validación, 401 de autenticación).
 *   3. Que Socket.io (engine.io) acepte el handshake.
 *   4. Que los esquemas Zod acepten/rechacen lo que corresponde.
 *   5. Seguridad: JWT (firma, verificación y rechazo de manipulación) y bcrypt.
 *   6. Serializadores: campos calculados y NO exposición del PIN ni del hash.
 *   7. Middlewares de rol, de validación y el error handler global.
 *   8. Que los jobs programados (no-show y alerta de vencimiento) toleren la
 *      caída de la base de datos.
 *   9. Reglas del Sprint 3: estados no-show, severidades de falla, validación
 *      de devolución con reporte y configuración de extensión/alerta.
 *
 *  Uso:  npm run test:humo      (desde /server)
 *  Salida: resumen con la cantidad de pruebas y fallos; código de salida 1 si
 *  alguna falla (apto para integrarse en CI como paso previo a las migraciones).
 * =============================================================================
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// --- Variables de entorno de respaldo (permite ejecutarlo sin .env) ---------
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/prestamos_itu';
process.env.JWT_SECRET ??= 'secreto_solo_para_pruebas_de_humo_no_usar_en_produccion';
process.env.JWT_EXPIRES_IN ??= '8h';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.DURACION_PRESTAMO_MINUTOS ??= '80';
process.env.ANTICIPACION_MAXIMA_MINUTOS ??= '60';
process.env.TOLERANCIA_CHECK_IN_MINUTOS ??= '15';
process.env.ANTICIPACION_RETIRO_MINUTOS ??= '10';
process.env.ALERTA_VENCIMIENTO_MINUTOS ??= '15';
process.env.EXTENSION_PRESTAMO_MINUTOS ??= '60';
process.env.SALT_ROUNDS ??= '10';

// Resolución de rutas relativa al script (funciona en cualquier máquina).
const aqui = path.dirname(fileURLToPath(import.meta.url));
const base = `${pathToFileURL(path.join(aqui, '..', 'src')).href}/`;

let pruebas = 0;
let fallos = 0;
const fallosDetalle = [];

function check(condicion, descripcion, extra = '') {
  pruebas += 1;
  if (condicion) {
    console.log(`  ✅ ${descripcion}`);
  } else {
    fallos += 1;
    fallosDetalle.push(`${descripcion}${extra ? ` [${extra}]` : ''}`);
    console.log(`  ❌ ${descripcion}${extra ? ` -> ${extra}` : ''}`);
  }
}

function crearResMock() {
  const res = { statusCodigo: null, cuerpo: null };
  res.status = (codigo) => {
    res.statusCodigo = codigo;
    return res;
  };
  res.json = (cuerpo) => {
    res.cuerpo = cuerpo;
    return res;
  };
  return res;
}

// ---------------------------------------------------------------------------
// 1) Importación de todos los módulos
// ---------------------------------------------------------------------------
console.log('\n[1/7] Importación de módulos');
const { app } = await import(`${base}app.js`);
const { iniciarSocket, cerrarSocket, emitirComputadoraActualizada, audienciaDePrestamo } = await import(`${base}realtime/socket.js`);
const { expirarReservasVencidas } = await import(`${base}services/prestamo.service.js`);
const { listarComputadoras, obtenerEstadisticas } = await import(`${base}services/computadora.service.js`);
const { registrarAlumno, iniciarSesion, obtenerPerfil } = await import(`${base}services/auth.service.js`);
const { validar } = await import(`${base}middlewares/validate.middleware.js`);
const { requerirRol, soloAlumno } = await import(`${base}middlewares/role.middleware.js`);
const { autenticar } = await import(`${base}middlewares/auth.middleware.js`);
const { manejadorErrores, manejadorRutaNoEncontrada } = await import(`${base}middlewares/error.middleware.js`);
const { esquemaReservar, esquemaCheckIn, esquemaDevolver, esquemaEstadoComputadora } = await import(`${base}validators/prestamo.validator.js`);
const { esquemaRegistro, esquemaLogin } = await import(`${base}validators/auth.validator.js`);
const { serializarComputadora, serializarPrestamo, serializarReporteFalla } = await import(`${base}utils/serializers.js`);
const { generarPin, esPinValido } = await import(`${base}utils/pin.js`);
const { firmarToken, verificarToken } = await import(`${base}utils/token.js`);
const { sumarMinutos, segundosRestantesHasta } = await import(`${base}utils/fechas.js`);
const { hashearPassword, verificarPassword } = await import(`${base}utils/passwords.js`);
const { ApiError } = await import(`${base}utils/ApiError.js`);
const { env } = await import(`${base}config/env.js`);
const { iniciarJobExpiracion, detenerJobExpiracion } = await import(`${base}jobs/expiracionReservas.job.js`);
const { avisarPrestamosPorVencer, iniciarJobAlerta, detenerJobAlerta } = await import(`${base}jobs/alertaVencimiento.job.js`);
const { desconectarBD } = await import(`${base}config/prisma.js`);
const { ESTADO_PRESTAMO, PRESTAMOS_VIGENTES, PRESTAMOS_HISTORIAL, SEVERIDAD_FALLA, EVENTOS_SOCKET } = await import(`${base}config/constants.js`);

check(
  Boolean(
    app &&
      iniciarSocket &&
      expirarReservasVencidas &&
      avisarPrestamosPorVencer &&
      listarComputadoras &&
      obtenerEstadisticas &&
      registrarAlumno &&
      iniciarSesion &&
      obtenerPerfil &&
      autenticar &&
      manejadorErrores,
  ),
  'todos los módulos se importan correctamente',
);

// ---------------------------------------------------------------------------
// 2) Pipeline HTTP + Socket.io (sin base de datos)
// ---------------------------------------------------------------------------
console.log('\n[2/7] Pipeline HTTP y Socket.io');
const servidor = http.createServer(app);
iniciarSocket(servidor);
await new Promise((resolver) => servidor.listen(0, resolver));
const url = `http://127.0.0.1:${servidor.address().port}`;

const salud = await fetch(`${url}/api/health`);
const cuerpoSalud = await salud.json();
check(salud.status === 200, 'GET /api/health responde 200');
check(cuerpoSalud.ok === true && cuerpoSalud.data.estado === 'ok', 'el contrato { ok, data } es el esperado');
check(typeof cuerpoSalud.meta.servidor_timestamp === 'number', 'incluye meta.servidor_timestamp (reloj del servidor)');

const inexistente = await fetch(`${url}/api/ruta-inexistente`);
const cuerpo404 = await inexistente.json();
check(inexistente.status === 404 && cuerpo404.error.codigo === 'RUTA_NO_ENCONTRADA', '404 semántico en rutas inexistentes');

const sinToken = await fetch(`${url}/api/computadoras`);
const cuerpo401 = await sinToken.json();
check(sinToken.status === 401 && cuerpo401.error.codigo === 'NO_AUTENTICADO', '401 sin token de sesión');

const conTokenFalso = await fetch(`${url}/api/computadoras`, {
  headers: { Authorization: 'Bearer token.invalido.falso' },
});
check(conTokenFalso.status === 401, '401 con token inválido');

const jsonRoto = await fetch(`${url}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{esto no es json',
});
check(jsonRoto.status === 400, '400 con JSON mal formado (no tumba el proceso)');

const invalido = await fetch(`${url}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'no-es-email', password: '' }),
});
const cuerpoInvalido = await invalido.json();
check(invalido.status === 400 && cuerpoInvalido.error.codigo === 'SOLICITUD_INVALIDA', '400 con cuerpo inválido');
check(
  Array.isArray(cuerpoInvalido.error.detalles) && cuerpoInvalido.error.detalles.length >= 2,
  'el error 400 detalla los campos inválidos',
);

const handshake = await fetch(`${url}/socket.io/?EIO=4&transport=polling`);
const textoHandshake = await handshake.text();
check(handshake.status === 200 && textoHandshake.startsWith('0{'), 'Socket.io responde al handshake (engine.io activo)');
check(textoHandshake.includes('"upgrades"'), 'Socket.io ofrece el upgrade a websocket');

// ---------------------------------------------------------------------------
// 3) Validación de entrada (Zod)
// ---------------------------------------------------------------------------
console.log('\n[3/7] Validación de entrada (Zod)');
const registroValido = esquemaRegistro.safeParse({
  dni: '40111222',
  nombre: 'Lucía',
  apellido: 'Fernández',
  email: 'LUCIA@ALUMNOS.EDU.AR',
  password: 'Alumno123!',
});
check(registroValido.success, 'registro válido aceptado');
check(registroValido.data?.email === 'lucia@alumnos.edu.ar', 'el email se normaliza a minúsculas');
check(!esquemaRegistro.safeParse({ dni: 'AB', nombre: 'A', apellido: '', email: 'x', password: '123' }).success, 'registro inválido rechazado');
check(!esquemaRegistro.safeParse({ dni: '40111222', nombre: 'Ana', apellido: 'Pérez', email: 'ana@x.com', password: 'sololetras' }).success, 'contraseña sin números rechazada');
check(!esquemaLogin.safeParse({ email: 'ok@x.com' }).success, 'login sin contraseña rechazado');
check(esquemaReservar.safeParse({ computadora_id: '6f1e6a0e-1b1a-4b1a-9b1a-1b1a1b1a1b1a' }).success, 'reserva inmediata válida');
check(
  esquemaReservar.safeParse({
    computadora_id: '6f1e6a0e-1b1a-4b1a-9b1a-1b1a1b1a1b1a',
    inicio_programado: new Date(Date.now() + 60_000).toISOString(),
  }).success,
  'reserva programada con fecha ISO 8601 válida',
);
check(!esquemaReservar.safeParse({ computadora_id: 'no-es-un-uuid' }).success, 'identificador no UUID rechazado');
check(esquemaCheckIn.safeParse({ token: '4321' }).success, 'PIN de 4 dígitos aceptado');
check(!esquemaCheckIn.safeParse({ token: '12a4' }).success, 'PIN no numérico rechazado');

// --- Sprint 3: devolución con reporte y cambio de estado manual -------------
check(esquemaDevolver.safeParse({}).success, 'devolución sin observaciones ni reporte válida');
check(
  esquemaDevolver.safeParse({
    observaciones: 'Equipo entregado en el mostrador.',
    reporte: { severidad: 'GRAVE', descripcion: 'Se apaga sola al abrir muchas ventanas.' },
  }).success,
  'devolución con observaciones y reporte GRAVE válida',
);
check(!esquemaDevolver.safeParse({ reporte: { severidad: 'NUCLEAR', descripcion: 'x'.repeat(20) } }).success, 'severidad desconocida rechazada');
check(!esquemaDevolver.safeParse({ reporte: { severidad: 'LEVE', descripcion: 'corta' } }).success, 'descripción de falla demasiado corta rechazada');
check(!esquemaDevolver.safeParse({ observaciones: 'x'.repeat(301) }).success, 'observaciones de más de 300 caracteres rechazadas');
check(esquemaEstadoComputadora.safeParse({ estado: 'MANTENIMIENTO' }).success, 'cambio manual a MANTENIMIENTO aceptado');
check(esquemaEstadoComputadora.safeParse({ estado: 'DISPONIBLE' }).success, 'reintegro manual a DISPONIBLE aceptado');
check(!esquemaEstadoComputadora.safeParse({ estado: 'EN_USO' }).success, 'el estado manual no permite EN_USO');

// ---------------------------------------------------------------------------
// 4) Seguridad: PIN, JWT y bcrypt
// ---------------------------------------------------------------------------
console.log('\n[4/7] Seguridad (PIN, JWT, bcrypt)');
const pines = Array.from({ length: 300 }, () => generarPin());
check(pines.every((pin) => esPinValido(pin)), 'todos los PIN generados tienen 4 dígitos');
check(new Set(pines).size > 250, 'los PIN tienen buena dispersión (CSPRNG, no Math.random)');

const token = firmarToken({ id: 'u-1', rol: 'ALUMNO', dni: '40111222' });
const payload = verificarToken(token);
check(payload.sub === 'u-1' && payload.rol === 'ALUMNO', 'el JWT se firma y verifica con el mismo payload');

let rechazoDeManipulacion = false;
try {
  verificarToken(`${token.slice(0, -2)}aa`);
} catch (error) {
  rechazoDeManipulacion = error.status === 401;
}
check(rechazoDeManipulacion, 'un JWT manipulado se rechaza con 401');

const hash = await hashearPassword('Secreta123!');
check(hash.startsWith('$2') && hash.length > 50, 'la contraseña se almacena hasheada con bcrypt');
check(await verificarPassword('Secreta123!', hash), 'la verificación de contraseña es correcta');
check(!(await verificarPassword('otra-clave', hash)), 'una contraseña incorrecta no valida');

// ---------------------------------------------------------------------------
// 5) Serializadores (privacidad y campos calculados de la UI)
// ---------------------------------------------------------------------------
console.log('\n[5/7] Serializadores');
const ahora = new Date();
const pcSerializada = serializarComputadora(
  {
    id: 'pc-1',
    codigo_inventario: 'CX-08',
    modelo: 'CX',
    especificaciones: 'i7 / 16GB',
    estado: 'RESERVADA',
    actualizado_en: ahora,
    prestamos: [
      {
        id: 'pr-1',
        estado: 'PENDIENTE_RETIRO',
        fecha_hora_inicio: sumarMinutos(ahora, 10),
        fecha_hora_fin_estimada: sumarMinutos(ahora, 70),
        token_validacion: '4321',
        usuario: { nombre: 'Lucía', apellido: 'Fernández', dni: '40111222' },
      },
    ],
  },
  ahora,
);
check(pcSerializada.estado === 'RESERVADA' && pcSerializada.liberacion_en instanceof Date, 'la computadora incluye liberacion_en');
check(pcSerializada.tiempo_restante_segundos === 25 * 60, 'una PC RESERVADA se libera a inicio + tolerancia (15 min)', `=> ${pcSerializada.tiempo_restante_segundos}s`);
check(pcSerializada.prestamo_activo.usuario.dni === '****222', 'el DNI se enmascara en el catálogo');
check(pcSerializada.prestamo_activo.token_validacion === undefined, 'el PIN NO se expone en el catálogo');

const dtoPrestamo = serializarPrestamo(
  {
    id: 'pr-1',
    estado: 'PENDIENTE_RETIRO',
    fecha_hora_inicio: ahora,
    fecha_hora_fin_estimada: sumarMinutos(ahora, 80),
    fecha_hora_fin_real: null,
    creado_en: ahora,
    token_validacion: '4321',
    usuario: { id: 'u-1', dni: '40111222', nombre: 'Lucía', apellido: 'Fernández', email: 'l@x.com', rol: 'ALUMNO', estado: 'ACTIVO', password: 'HASH' },
    computadora: { id: 'pc-1', codigo_inventario: 'CX-01', modelo: 'CX', estado: 'RESERVADA' },
  },
  { mostrarPin: true, ahora },
);
check(dtoPrestamo.token_validacion === '4321', 'el PIN sí se incluye para el dueño o secretaría');
check(dtoPrestamo.usuario.password === undefined, 'el hash de la contraseña nunca se serializa');
check(dtoPrestamo.tiempo_restante_segundos === 4800 && dtoPrestamo.vencido === false, 'calcula tiempo restante y vencimiento');
check(dtoPrestamo.limite_retiro instanceof Date, 'calcula el límite de retiro de la reserva');
check(
  serializarPrestamo({ id: 'x', estado: 'ACTIVO', fecha_hora_inicio: ahora, fecha_hora_fin_estimada: ahora, token_validacion: '1', creado_en: ahora }, { mostrarPin: false })
    .token_validacion === undefined,
  'el PIN se omite cuando el contexto no lo requiere',
);

// --- Sprint 3: reportes de falla y campos nuevos del préstamo ----------------
const dtoReporte = serializarReporteFalla({
  id: 'rf-1',
  descripcion: 'Se traba el teclado.',
  severidad: 'GRAVE',
  resuelto: false,
  estado: 'PENDIENTE',
  creado_en: ahora,
  prestamo_id: 'pr-9',
  computadora_id: 'pc-1',
  usuario: { nombre: 'Tomás', apellido: 'Ríos', dni: '41222333' },
});
check(dtoReporte.severidad === 'GRAVE' && dtoReporte.resuelto === false, 'el reporte expone severidad y bandera resuelto');
check(dtoReporte.usuario.dni === '****333', 'el DNI del reporte se enmascara');
check(serializarReporteFalla({ ...dtoReporte, usuario: { password: 'HASH' } }).usuario.password === undefined, 'el reporte nunca expone el hash de contraseña');

const dtoPrestamoConDevolucion = serializarPrestamo(
  {
    id: 'pr-2',
    estado: 'FINALIZADO',
    fecha_hora_inicio: ahora,
    fecha_hora_fin_estimada: sumarMinutos(ahora, 80),
    fecha_hora_fin_real: ahora,
    creado_en: ahora,
    observaciones_devolucion: 'Se entregó con observaciones.',
    reportes: [{ id: 'rf-1', descripcion: 'x', severidad: 'LEVE', resuelto: true, estado: 'RESUELTO', creado_en: ahora, prestamo_id: 'pr-2', usuario_id: 'u-1' }],
    token_validacion: '4321',
  },
  { ahora },
);
check(dtoPrestamoConDevolucion.observaciones_devolucion === 'Se entregó con observaciones.', 'el préstamo serializa las observaciones de devolución');
check(
  Array.isArray(dtoPrestamoConDevolucion.reportes) && dtoPrestamoConDevolucion.reportes[0].resuelto === true,
  'el préstamo embebe sus reportes de falla',
);
check(serializarPrestamo({ id: 'pr-3', estado: 'ACTIVO', fecha_hora_inicio: ahora, fecha_hora_fin_estimada: ahora, creado_en: ahora }, { ahora }).reportes.length === 0, 'un préstamo sin reportes expone una lista vacía');

// ---------------------------------------------------------------------------
// 6) Middlewares (roles, validación y errores)
// ---------------------------------------------------------------------------
console.log('\n[6/7] Middlewares');
const reqAlumno = { usuario: { id: 'u1', rol: 'ALUMNO' } };
let resultadoRol = null;
soloAlumno(reqAlumno, crearResMock(), (error) => {
  resultadoRol = error;
});
check(resultadoRol === undefined, 'roleMiddleware permite el rol autorizado');

let errorRol = null;
requerirRol('SECRETARIO')(reqAlumno, crearResMock(), (error) => {
  errorRol = error;
});
check(errorRol?.status === 403 && errorRol.codigo === 'SIN_PERMISOS', 'roleMiddleware bloquea con 403 el rol no autorizado');

let errorValidacion = null;
validar({ body: esquemaCheckIn })({ body: { token: 'xyz' } }, crearResMock(), (error) => {
  errorValidacion = error;
});
check(errorValidacion?.status === 400, 'validate() corta la cadena y deriva el 400 al error handler');
check(errorValidacion?.detalles?.[0]?.campo === 'token', 'validate() identifica el campo inválido');

const reqConEspacios = { body: { token: ' 4321 ' } };
let pasoValidacion = false;
validar({ body: esquemaCheckIn })(reqConEspacios, crearResMock(), () => {
  pasoValidacion = true;
});
check(pasoValidacion && reqConEspacios.body.token === '4321', 'validate() normaliza los datos (trim aplicado)');

const reqQuery = { query: { estado: '  DISPONIBLE ', busqueda: 'pc-00 ' } };
const { esquemaFiltrosComputadoras } = await import(`${base}validators/prestamo.validator.js`);
validar({ query: esquemaFiltrosComputadoras })(reqQuery, crearResMock(), () => {});
check(reqQuery.query.estado === 'DISPONIBLE', 'validate() normaliza también la query string');

const resError = crearResMock();
manejadorErrores(
  ApiError.conflicto('La computadora acaba de ser tomada', { parametro: 'computadora_ocupada' }),
  { method: 'POST', originalUrl: '/api/prestamos/reservar' },
  resError,
  () => {},
);
check(resError.statusCodigo === 409 && resError.cuerpo.error.codigo === 'CONFLICTO_DE_ESTADO', 'el error handler responde 409 con el contrato de errores');
check(!('stack' in resError.cuerpo.error), 'el error handler no filtra stack traces al cliente');

const resRuta = crearResMock();
manejadorRutaNoEncontrada({ method: 'GET', originalUrl: '/api/x' }, resRuta, (error) =>
  manejadorErrores(error, { method: 'GET', originalUrl: '/api/x' }, resRuta, () => {}),
);
check(resRuta.statusCodigo === 404, 'manejadorRutaNoEncontrada responde 404');

const resServidor = crearResMock();
manejadorErrores(new Error('falla inesperada'), { method: 'GET', originalUrl: '/api/x' }, resServidor, () => {});
check(resServidor.statusCodigo === 500 && resServidor.cuerpo.error.mensaje === 'Ocurrió un error inesperado en el servidor.', 'un error inesperado se convierte en 500 genérico (sin filtrar detalles)');

// ---------------------------------------------------------------------------
// 7) Configuración y job de expiración
// ---------------------------------------------------------------------------
console.log('\n[7/7] Configuración y job de expiración');
check(env.negocio.duracionPrestamoMinutos === 80, 'duración del préstamo leída del entorno (80 min)');
check(env.negocio.anticipacionMaximaMinutos === 60, 'anticipación máxima de reserva (60 min)');
check(env.negocio.toleranciaCheckInMinutos === 15, 'tolerancia de retiro (15 min)');
check(env.negocio.alertaVencimientoMinutos === 15, 'alerta preventiva de vencimiento (15 min)');
check(env.negocio.extensionPrestamoMinutos === 60, 'extensión de préstamo (+60 min)');
check(env.negocio.ventanaExtensionReservaMinutos === 60, 'ventana de reserva que bloquea la extensión (60 min)');
check(env.saltRounds === 10, 'salt rounds de bcrypt (10)');
check(env.corsOrigins.includes('http://localhost:5173'), 'CORS_ORIGIN se parsea como lista');

// --- Estados del ciclo de vida (Sprint 3: no-show) --------------------------
check(ESTADO_PRESTAMO.CANCELADO_NO_SHOW === 'CANCELADO_NO_SHOW', 'el estado CANCELADO_NO_SHOW existe en el dominio');
check(!PRESTAMOS_VIGENTES.includes(ESTADO_PRESTAMO.CANCELADO_NO_SHOW), 'un no-show NO ocupa al alumno (puede reservar de nuevo)');
check(PRESTAMOS_HISTORIAL.includes(ESTADO_PRESTAMO.CANCELADO_NO_SHOW), 'los no-show aparecen en el historial');
check(SEVERIDAD_FALLA.CRITICA === 'CRITICA', 'las severidades de falla LEVE/GRAVE/CRITICA existen');
check(EVENTOS_SOCKET.PRESTAMO_POR_VENCER === 'prestamo_por_vencer', 'el evento de alerta de vencimiento está declarado');

// El job consulta la BD al arrancar; sin base disponible debe sobrevivir.
iniciarJobExpiracion();
await new Promise((resolver) => setTimeout(resolver, 1500));
detenerJobExpiracion();
check(true, 'el job de expiración tolera errores de BD y se detiene limpiamente');

// Mismo criterio para el job de alerta de vencimiento (Sprint 3).
iniciarJobAlerta();
await new Promise((resolver) => setTimeout(resolver, 1500));
detenerJobAlerta();
check(true, 'el job de alerta de vencimiento tolera errores de BD y se detiene limpiamente');

emitirComputadoraActualizada(pcSerializada, 'prueba');
check(true, 'emitir eventos de socket sin clientes conectados no lanza errores');

// Los eventos de préstamo llevan PIN: solo van a secretaría y al alumno dueño.
check(
  JSON.stringify(audienciaDePrestamo({ usuario: { id: 'u-1' } })) === JSON.stringify(['secretaria', 'usuario:u-1']),
  'un evento de préstamo se dirige a secretaría y a la sala del alumno dueño',
);
check(
  JSON.stringify(audienciaDePrestamo({ id: 'pr-1' })) === JSON.stringify(['secretaria']),
  'sin usuario en el DTO, el evento de préstamo NO se difunde a todos (protege el PIN)',
);

// ---------------------------------------------------------------------------
// Cierre
// ---------------------------------------------------------------------------
await cerrarSocket();
await new Promise((resolver) => servidor.close(resolver));
await desconectarBD();

console.log(`\n${'='.repeat(64)}`);
if (fallos === 0) {
  console.log(`OK - Prueba de humo sin fallos: ${pruebas} verificaciones.`);
} else {
  console.log(`FALLO - Prueba de humo: ${fallos} de ${pruebas} verificaciones fallaron.`);
  // Se listan al final en ASCII plano para que sean fáciles de leer en CI.
  fallosDetalle.forEach((detalle, indice) => console.log(`  ${indice + 1}) ${detalle}`));
}
console.log(`${'='.repeat(64)}\n`);

process.exit(fallos === 0 ? 0 : 1);
