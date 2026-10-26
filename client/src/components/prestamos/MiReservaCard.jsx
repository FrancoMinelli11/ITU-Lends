/**
 * =============================================================================
 *  MiReservaCard - Préstamo vigente del alumno
 * =============================================================================
 *  Dos situaciones posibles:
 *   - PENDIENTE_RETIRO: muestra el PIN y el tiempo que le queda para retirarlo.
 *   - ACTIVO: muestra el tiempo restante de uso, alerta si ya venció y ofrece
 *     la extensión (+60 min) y la devolución con feedback (Sprint 3).
 * =============================================================================
 */

import { AlertTriangle, CalendarClock, Cpu, KeyRound, PackageCheck, PlusCircle, Timer, Trash2 } from 'lucide-react';
import { ESTADO_PRESTAMO } from '../../constants/estados.js';
import { REGLAS } from '../../constants/reglas.js';
import { formatearFechaHora, formatearHora } from '../../utils/format.js';
import { BadgePrestamo } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { CountdownTexto } from '../computadoras/CountdownTexto.jsx';
import { PinDisplay } from './PinDisplay.jsx';

export function MiReservaCard({
  prestamo,
  onCancelar,
  cancelando = false,
  onExtender,
  exteniendo = false,
  onDevolver,
  devolviendo = false,
}) {
  if (!prestamo) return null;

  const esPendiente = prestamo.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO;
  const esActivo = prestamo.estado === ESTADO_PRESTAMO.ACTIVO;

  return (
    <section
      className={`tarjeta overflow-hidden ${
        esPendiente ? 'ring-2 ring-amber-200' : esActivo ? 'ring-2 ring-indigo-200' : ''
      }`}
      aria-label="Mi préstamo actual"
    >
      {/* Franja superior con el estado */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${
          esPendiente ? 'bg-amber-50' : esActivo ? 'bg-indigo-50' : 'bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Mi préstamo actual</span>
          <BadgePrestamo estado={prestamo.estado} />
        </div>
        <span className="text-xs text-slate-500">
          Reservado el {formatearFechaHora(prestamo.creado_en)}
        </span>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2">
        {/* --- Datos del equipo -------------------------------------------- */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Cpu className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {prestamo.computadora?.codigo_inventario ?? '—'}
              </p>
              <p className="text-sm text-slate-600">{prestamo.computadora?.modelo ?? 'Computadora'}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="flex items-center gap-1 text-xs text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Retiro
              </dt>
              <dd className="font-medium text-slate-800">{formatearHora(prestamo.fecha_hora_inicio)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-slate-500">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Devolución estimada
              </dt>
              <dd className="font-medium text-slate-800">
                {formatearHora(prestamo.fecha_hora_fin_estimada)}
              </dd>
            </div>
          </dl>

          {/* Contexto temporal + acción */}
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
            {esPendiente && (
              <>
                <p className="text-sm text-slate-600">
                  Retirá el equipo en secretaría antes de las{' '}
                  <strong className="text-slate-800">{formatearHora(prestamo.limite_retiro)}</strong>
                </p>
                <CountdownTexto
                  hasta={prestamo.limite_retiro}
                  prefijo="Tiempo para retirar:"
                  umbralUrgente={300}
                />
              </>
            )}

            {esActivo && (
              <>
                <p className="text-sm text-slate-600">
                  {prestamo.vencido
                    ? 'El tiempo estimado de uso ya finalizó. Devolvé el equipo en secretaría.'
                    : 'Devolvé el equipo antes de la hora estimada para liberar el turno.'}
                </p>
                <CountdownTexto
                  hasta={prestamo.fecha_hora_fin_estimada}
                  prefijo="Tiempo de uso restante:"
                  umbralUrgente={600}
                />
              </>
            )}

            {prestamo.vencido && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Préstamo vencido: acercate a secretaría a la brevedad.
              </p>
            )}

            {esPendiente && (
              <Button
                variante="secundario"
                tamano="sm"
                Icono={Trash2}
                className="w-full"
                cargando={cancelando}
                onClick={() => onCancelar?.(prestamo)}
              >
                Cancelar reserva
              </Button>
            )}

            {esActivo && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variante="secundario"
                  tamano="sm"
                  Icono={PlusCircle}
                  cargando={exteniendo}
                  disabled={prestamo.vencido}
                  onClick={() => onExtender?.(prestamo)}
                  title={
                    prestamo.vencido
                      ? 'El préstamo ya venció: devolvé el equipo en secretaría.'
                      : `Suma ${REGLAS.extensionMinutos} minutos a la devolución estimada`
                  }
                >
                  Extender +{REGLAS.extensionMinutos} min
                </Button>
                <Button
                  variante="exito"
                  tamano="sm"
                  Icono={PackageCheck}
                  cargando={devolviendo}
                  onClick={() => onDevolver?.(prestamo)}
                >
                  Devolver equipo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* --- PIN de retiro ---------------------------------------------- */}
        <div className="flex flex-col justify-center gap-3 rounded-2xl bg-slate-900 p-5 text-center">
          {esPendiente ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-300">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> PIN de retiro
              </p>
              <PinDisplay pin={prestamo.token_validacion} className="text-white" />
              <p className="text-xs text-slate-400">
                Dictá este código en secretaría para que activen tu equipo.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                Equipo en uso
              </p>
              <p className="text-2xl font-semibold text-white">
                {prestamo.computadora?.codigo_inventario}
              </p>
              <p className="text-xs text-slate-400">
                El PIN ya fue validado por secretaría. Cuando lo devuelvas, el préstamo se cerrará.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
