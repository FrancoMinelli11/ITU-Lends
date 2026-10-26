/**
 * =============================================================================
 *  Utilidades de formato (fechas, horas y texto)
 * =============================================================================
 */

const LOCAL = 'es-AR';

/** Hora corta: "14:35" */
export function formatearHora(fechaISO) {
  if (!fechaISO) return '—';
  return new Date(fechaISO).toLocaleTimeString(LOCAL, { hour: '2-digit', minute: '2-digit' });
}

/** Hora con segundos: "14:35:09" */
export function formatearHoraConSegundos(fechaISO) {
  if (!fechaISO) return '—';
  return new Date(fechaISO).toLocaleTimeString(LOCAL, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Fecha y hora: "lun 19/10 · 14:35" */
export function formatearFechaHora(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO);
  const dia = fecha.toLocaleDateString(LOCAL, { weekday: 'short', day: '2-digit', month: '2-digit' });
  return `${dia} · ${fecha.toLocaleTimeString(LOCAL, { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Duración legible a partir de segundos: "01:59:30" o "12:05" (cifras fijas).
 * Se usa en los contadores regresivos.
 */
export function formatearSegundos(segundos) {
  const total = Math.max(0, Math.floor(segundos ?? 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  const dd = (n) => String(n).padStart(2, '0');

  return horas > 0 ? `${horas}:${dd(minutos)}:${dd(seg)}` : `${dd(minutos)}:${dd(seg)}`;
}

/** Duración en palabras: "45 min", "1 h 20 min". */
export function formatearDuracion(segundos) {
  const total = Math.max(0, Math.floor(segundos ?? 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.round((total % 3600) / 60);

  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

/** Bloquea la sincronización de la UI: siempre muestra 4 dígitos del PIN. */
export function formatearPin(pin) {
  return String(pin ?? '').padStart(4, '0');
}

/** Máscara de DNI para listados: "****222". */
export function enmascararDni(dni) {
  if (!dni) return '—';
  const texto = String(dni);
  return texto.length <= 3 ? texto : `****${texto.slice(-3)}`;
}

/** Iniciales para el avatar: "Lucía Fernández" -> "LF". */
export function iniciales(nombreCompleto = '') {
  return nombreCompleto
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}

/** Valor para <input type="datetime-local"> a partir de un Date. */
export function aInputDatetimeLocal(fecha) {
  const d = new Date(fecha);
  const dd = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}T${dd(d.getHours())}:${dd(d.getMinutes())}`;
}
