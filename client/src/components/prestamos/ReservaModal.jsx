/**
 * =============================================================================
 *  ReservaModal - Solicitud de reserva (inmediata o programada)
 * =============================================================================
 *  Flujo de dos pasos:
 *    1. "config" -> el alumno elige cuándo: ahora mismo o hasta 60 min después.
 *    2. "pin"    -> confirmación con el PIN de 4 dígitos que debe presentar en
 *                   secretaría para el check-in.
 *
 *  La reserva inmediata se envía SIN fecha: el backend resuelve la hora con el
 *  reloj del servidor, evitando desfasajes del dispositivo del alumno.
 * =============================================================================
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Info, Zap } from 'lucide-react';
import { reservarRequest } from '../../api/prestamos.api.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import { REGLAS } from '../../constants/reglas.js';
import { aInputDatetimeLocal, formatearHora } from '../../utils/format.js';
import { ahora as ahoraSincronizada } from '../../utils/reloj.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { PinDisplay } from './PinDisplay.jsx';

/** Modos de reserva disponibles. */
const MODO = { AHORA: 'ahora', PROGRAMAR: 'programar' };

export function ReservaModal({ computadora, abierta, onCerrar, onReservado }) {
  const [modo, setModo] = useState(MODO.AHORA);
  const [fechaLocal, setFechaLocal] = useState('');
  const [errorValidacion, setErrorValidacion] = useState(null);
  const [resultado, setResultado] = useState(null);

  const { ejecutar, enProceso, errorMensaje, detallesError, reiniciar } = useAsyncAction(reservarRequest);

  // Rango permitido para programar: [ahora, ahora + 60 min] según el reloj del servidor.
  const limites = useMemo(() => {
    const desde = new Date(ahoraSincronizada() + 60 * 1000); // 1 min de margen
    const hasta = new Date(ahoraSincronizada() + REGLAS.anticipacionMaximaMinutos * 60 * 1000);
    return { desde, hasta };
  }, [abierta]);

  // Ventana de retiro una vez generada la reserva: inicio + tolerancia.
  const limiteRetiro = resultado?.prestamo?.limite_retiro ?? null;
  const { texto: restanteParaRetiro } = useCountdown(limiteRetiro);

  // --- Reset al abrir/cerrar -----------------------------------------------
  useEffect(() => {
    if (!abierta) return;
    setModo(MODO.AHORA);
    setFechaLocal(aInputDatetimeLocal(limites.desde));
    setErrorValidacion(null);
    setResultado(null);
    reiniciar();
  }, [abierta, limites.desde, reiniciar]);

  const cerrar = () => {
    if (enProceso) return; // No cerrar mientras se está confirmando.
    onCerrar?.();
  };

  /** Valida localmente y dispara la petición al backend. */
  const confirmar = async () => {
    setErrorValidacion(null);

    let inicioProgramado = null;

    if (modo === MODO.PROGRAMAR) {
      if (!fechaLocal) {
        setErrorValidacion('Elegí la hora a la que querés retirar el equipo.');
        return;
      }

      const seleccionada = new Date(fechaLocal);

      if (Number.isNaN(seleccionada.getTime())) {
        setErrorValidacion('La fecha seleccionada no es válida.');
        return;
      }

      if (seleccionada.getTime() < limites.desde.getTime() - 60 * 1000) {
        setErrorValidacion('La hora elegida ya pasó. Seleccioná un horario futuro.');
        return;
      }

      if (seleccionada.getTime() > limites.hasta.getTime()) {
        setErrorValidacion(
          `Solo podés reservar con hasta ${REGLAS.anticipacionMaximaMinutos} minutos de anticipación.`,
        );
        return;
      }

      inicioProgramado = seleccionada.toISOString();
    }

    const respuesta = await ejecutar({
      computadora_id: computadora.id,
      inicio_programado: inicioProgramado,
    });

    if (respuesta) {
      setResultado(respuesta);
      onReservado?.(respuesta);
    }
  };

  if (!computadora) return null;

  const enPasoPin = Boolean(resultado);

  return (
    <Modal
      abierta={abierta}
      onCerrar={cerrar}
      ocultarCerrar={enProceso}
      cerrarConFondo={!enProceso}
      ancho="md"
      titulo={enPasoPin ? '¡Reserva confirmada!' : 'Reservar computadora'}
      descripcion={
        enPasoPin
          ? 'Presentá este PIN en secretaría para retirar el equipo.'
          : `${computadora.codigo_inventario} · ${computadora.modelo}`
      }
    >
      {/* ================= PASO 2: PIN generado ========================= */}
      {enPasoPin ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-inset ring-slate-200">
            <PinDisplay pin={resultado.prestamo.token_validacion} />
          </div>

          <Alert variante="aviso" titulo="Importante">
            <p>
              Retirá el equipo antes de las{' '}
              <strong>{formatearHora(resultado.prestamo.limite_retiro)}</strong> (te quedan{' '}
              <span className="font-mono font-semibold">{restanteParaRetiro}</span>). Si no te presentás,
              la reserva se cancela automáticamente y la computadora queda libre.
            </p>
          </Alert>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Equipo</dt>
              <dd className="font-semibold text-slate-800">{computadora.codigo_inventario}</dd>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Retiro desde</dt>
              <dd className="font-semibold text-slate-800">
                {formatearHora(resultado.prestamo.fecha_hora_inicio)}
              </dd>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Devolución estimada</dt>
              <dd className="font-semibold text-slate-800">
                {formatearHora(resultado.prestamo.fecha_hora_fin_estimada)}
              </dd>
            </div>
            <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Estado</dt>
              <dd className="font-semibold text-amber-600">Pendiente de retiro</dd>
            </div>
          </dl>

          <Button variante="primario" className="w-full" Icono={CheckCircle2} onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      ) : (
        /* ================= PASO 1: configuración ===================== */
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Opción: ahora mismo */}
            <button
              type="button"
              onClick={() => setModo(MODO.AHORA)}
              className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${
                modo === MODO.AHORA
                  ? 'border-marca-500 bg-marca-50 ring-1 ring-marca-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <Zap className={`h-5 w-5 ${modo === MODO.AHORA ? 'text-marca-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-800">Ahora mismo</span>
              <span className="text-xs text-slate-500">Retiro inmediato del equipo</span>
            </button>

            {/* Opción: programar */}
            <button
              type="button"
              onClick={() => setModo(MODO.PROGRAMAR)}
              className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition ${
                modo === MODO.PROGRAMAR
                  ? 'border-marca-500 bg-marca-50 ring-1 ring-marca-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <CalendarClock
                className={`h-5 w-5 ${modo === MODO.PROGRAMAR ? 'text-marca-600' : 'text-slate-400'}`}
              />
              <span className="text-sm font-semibold text-slate-800">Programar retiro</span>
              <span className="text-xs text-slate-500">
                Hasta {REGLAS.anticipacionMaximaMinutos} minutos de anticipación
              </span>
            </button>
          </div>

          {modo === MODO.PROGRAMAR && (
            <div className="animate-fade-in">
              <label htmlFor="inicio-programado" className="etiqueta">
                Hora de retiro
              </label>
              <input
                id="inicio-programado"
                type="datetime-local"
                value={fechaLocal}
                min={aInputDatetimeLocal(limites.desde)}
                max={aInputDatetimeLocal(limites.hasta)}
                onChange={(evento) => setFechaLocal(evento.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30"
              />
              <p className="texto-ayuda">
                Podés retirarlo entre las {formatearHora(limites.desde)} y las {formatearHora(limites.hasta)}.
              </p>
            </div>
          )}

          <Alert variante="info">
            <ul className="space-y-1">
              <li>• Se te asignará un PIN de 4 dígitos para validar el retiro.</li>
              <li>
                • Tenés {REGLAS.toleranciaCheckInMinutos} minutos de tolerancia para presentarte en
                secretaría; luego la reserva expira automáticamente.
              </li>
              <li>• Mientras tengas un préstamo vigente no podés reservar otro equipo.</li>
            </ul>
          </Alert>

          {errorValidacion && <Alert variante="error">{errorValidacion}</Alert>}

          {errorMensaje && (
            <Alert variante="error" titulo="No se pudo completar la reserva" detalles={detallesError}>
              {errorMensaje}
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={cerrar} disabled={enProceso}>
              Cancelar
            </Button>
            <Button Icono={Clock} onClick={confirmar} cargando={enProceso}>
              {enProceso ? 'Reservando...' : 'Confirmar reserva'}
            </Button>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            La disponibilidad se valida en el servidor al confirmar: si otro alumno se adelantó, te lo
            avisamos al instante.
          </p>
        </div>
      )}
    </Modal>
  );
}
