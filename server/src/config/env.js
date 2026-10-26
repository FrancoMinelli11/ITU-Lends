/**
 * =============================================================================
 *  Configuración centralizada del entorno (único punto de lectura de process.env)
 * =============================================================================
 *  Regla de Clean Architecture: ninguna otra capa lee `process.env` directamente.
 *  Si falta una variable crítica, el servidor falla al arrancar con un mensaje
 *  claro (fail fast) en lugar de romper en tiempo de ejecución.
 * =============================================================================
 */

import 'dotenv/config';

/** Lee una variable obligatoria; lanza error explicativo si no está definida. */
function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(
      `[config] Falta la variable de entorno obligatoria "${nombre}". ` +
        'Revisá tu archivo .env (podés basarte en .env.example).',
    );
  }
  return valor.trim();
}

/** Lee una variable numérica con valor por defecto y validación. */
function numero(nombre, porDefecto) {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === '') return porDefecto;
  const parseado = Number(valor);
  if (Number.isNaN(parseado)) {
    throw new Error(`[config] La variable "${nombre}" debe ser numérica (valor recibido: "${valor}").`);
  }
  return parseado;
}

/** Lee una lista separada por comas. */
function lista(nombre, porDefecto = []) {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') return porDefecto;
  return valor
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const esProduccion = process.env.NODE_ENV === 'production';

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  esProduccion,
  esDesarrollo: !esProduccion,
  puerto: numero('PORT', 4000),

  // Base de datos -----------------------------------------------------------
  databaseUrl: requerida('DATABASE_URL'),

  // Seguridad ---------------------------------------------------------------
  jwt: {
    secreto: requerida('JWT_SECRET'),
    expiraEn: process.env.JWT_EXPIRES_IN?.trim() || '8h',
  },
  saltRounds: numero('SALT_ROUNDS', 10),

  // CORS --------------------------------------------------------------------
  corsOrigins: lista('CORS_ORIGIN', ['http://localhost:5173']),

  // Reglas de negocio (minutos) ---------------------------------------------
  negocio: {
    duracionPrestamoMinutos: numero('DURACION_PRESTAMO_MINUTOS', 80),
    anticipacionMaximaMinutos: numero('ANTICIPACION_MAXIMA_MINUTOS', 60),
    toleranciaCheckInMinutos: numero('TOLERANCIA_CHECK_IN_MINUTOS', 15),
    anticipacionRetiroMinutos: numero('ANTICIPACION_RETIRO_MINUTOS', 10),
    intervaloExpiracionSegundos: numero('INTERVALO_EXPIRACION_SEGUNDOS', 30),
    // --- Sprint 3 ---
    /// Minutos de aviso preventivo antes de que venca un préstamo activo.
    alertaVencimientoMinutos: numero('ALERTA_VENCIMIENTO_MINUTOS', 15),
    /// Minutos que suma cada extensión de préstamo (US-05).
    extensionPrestamoMinutos: numero('EXTENSION_PRESTAMO_MINUTOS', 60),
    /// Ventana futura (minutos) en la que una reserva posterior bloquea la extensión.
    ventanaExtensionReservaMinutos: numero('VENTANA_EXTENSION_RESERVA_MINUTOS', 60),
    /// Frecuencia del job que dispara la alerta de vencimiento (segundos).
    intervaloAlertaSegundos: numero('INTERVALO_ALERTA_SEGUNDOS', 30),
  },
});
