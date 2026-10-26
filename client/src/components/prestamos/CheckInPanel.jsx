/**
 * =============================================================================
 *  CheckInPanel - Validación del PIN en el mostrador de secretaría
 * =============================================================================
 *  Pensado para uso rápido y con teclado numérico (touch en mostrador):
 *   - Solo admite dígitos (cualquier otro carácter se descarta al escribir).
 *   - Auto-envía al completar los 4 dígitos y también con Enter.
 *   - Teclado en pantalla opcional para tablets.
 *   - Feedback inmediato: verde con el detalle del préstamo o rojo con el motivo.
 *
 *  El componente es controlado por el padre (patrón "presentacional"): recibe el
 *  estado de la operación y no conoce la API.
 * =============================================================================
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Delete, KeyRound, Search, ShieldCheck, XCircle } from 'lucide-react';
import { formatearHora } from '../../utils/format.js';
import { Spinner } from '../ui/Spinner.jsx';
import { Button } from '../ui/Button.jsx';

const LARGO_PIN = 4;

export function CheckInPanel({ onValidar, enProceso = false, error = null, exito = null, onLimpiar }) {
  const [pin, setPin] = useState('');
  const inputRef = useRef(null);
  const envioAutomaticoRef = useRef(false);

  // Al completar los 4 dígitos se dispara la validación automáticamente.
  useEffect(() => {
    if (pin.length === LARGO_PIN && !enProceso && !envioAutomaticoRef.current) {
      envioAutomaticoRef.current = true;
      void onValidar?.(pin);
    }
    if (pin.length < LARGO_PIN) envioAutomaticoRef.current = false;
  }, [pin, enProceso, onValidar]);

  // Tras un resultado (éxito o error) se limpia el campo para el próximo alumno.
  useEffect(() => {
    if (exito || error) {
      setPin('');
      inputRef.current?.focus();
    }
  }, [exito, error]);

  const escribir = (digito) => {
    onLimpiar?.();
    setPin((previo) => (previo.length >= LARGO_PIN ? previo : `${previo}${digito}`));
  };

  const borrar = () => {
    onLimpiar?.();
    setPin((previo) => previo.slice(0, -1));
  };

  const enviar = () => {
    if (pin.length !== LARGO_PIN || enProceso) return;
    void onValidar?.(pin);
  };

  return (
    <div className="space-y-4">
      {/* --- Campo de PIN ------------------------------------------------ */}
      <div>
        <label htmlFor="pin-retiro" className="etiqueta">
          PIN de retiro del alumno
        </label>

        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="pin-retiro"
            ref={inputRef}
            value={pin}
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            maxLength={LARGO_PIN}
            placeholder="••••"
            aria-label="PIN de 4 dígitos"
            className="w-full rounded-xl border border-slate-300 bg-white py-4 pl-12 pr-4 font-mono text-3xl font-bold tracking-[0.4em] text-slate-900 shadow-sm placeholder:tracking-[0.4em] placeholder:text-slate-300 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30"
            onChange={(evento) => {
              onLimpiar?.();
              // Se conservan únicamente los dígitos escritos (ignora letras/símbolos).
              setPin(evento.target.value.replace(/\D/g, '').slice(0, LARGO_PIN));
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault();
                enviar();
              }
            }}
          />
        </div>

        {/* Progreso del PIN */}
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: LARGO_PIN }).map((_, indice) => (
            <span
              key={indice}
              className={`h-1.5 flex-1 rounded-full transition ${
                indice < pin.length ? 'bg-marca-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* --- Teclado numérico táctil ------------------------------------- */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digito) => (
          <button
            key={digito}
            type="button"
            onClick={() => escribir(digito)}
            className="rounded-xl border border-slate-200 bg-white py-3 text-xl font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
          >
            {digito}
          </button>
        ))}
        <button
          type="button"
          onClick={borrar}
          aria-label="Borrar último dígito"
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-slate-500 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
        >
          <Delete className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => escribir('0')}
          className="rounded-xl border border-slate-200 bg-white py-3 text-xl font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
        >
          0
        </button>
        <Button
          onClick={enviar}
          disabled={pin.length !== LARGO_PIN}
          cargando={enProceso}
          className="h-full"
          aria-label="Validar PIN"
        >
          {!enProceso && <ShieldCheck className="h-5 w-5" />}
        </Button>
      </div>

      {/* --- Feedback ---------------------------------------------------- */}
      {enProceso && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner tamanio="sm" className="text-marca-600" /> Validando PIN...
        </p>
      )}

      {exito && (
        <div className="animate-fade-in rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Préstamo activado correctamente
          </p>
          <p className="mt-1.5">
            <strong>
              {exito.prestamo?.usuario?.nombre} {exito.prestamo?.usuario?.apellido}
            </strong>{' '}
            (DNI {exito.prestamo?.usuario?.dni}) retira{' '}
            <strong className="font-mono">{exito.prestamo?.computadora?.codigo_inventario}</strong>.
          </p>
          <p className="mt-0.5 text-xs">
            Devolución estimada: {formatearHora(exito.prestamo?.fecha_hora_fin_estimada)}
          </p>
        </div>
      )}

      {error && (
        <div className="animate-fade-in rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-inset ring-rose-200" role="alert">
          <p className="flex items-center gap-2 font-semibold">
            <XCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
            No se pudo validar el PIN
          </p>
          <p className="mt-1.5">{error}</p>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Pedile al alumno el PIN de 4 dígitos que aparece en su panel. Al ingresarlo se valida y la
        computadora pasa a “En uso” automáticamente.
      </p>
    </div>
  );
}
