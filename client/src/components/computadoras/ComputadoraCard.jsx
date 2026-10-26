/**
 * Tarjeta del catálogo: representa una computadora y su disponibilidad.
 * Es un componente presentacional puro: recibe datos y callbacks, no conoce la API.
 */

import { Cpu, HardDrive, Lock, MonitorSmartphone, Sparkles } from 'lucide-react';
import { ESTADO_COMPUTADORA, META_ESTADO_COMPUTADORA } from '../../constants/estados.js';
import { BadgeComputadora } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { CountdownTexto } from './CountdownTexto.jsx';

/** Etiqueta y color del contador según el estado de la máquina. */
function TextoTiempo({ computadora }) {
  const { estado, liberacion_en: liberacionEn } = computadora;

  if (estado === ESTADO_COMPUTADORA.EN_USO) {
    return <CountdownTexto hasta={liberacionEn} prefijo="Se libera en" umbralUrgente={300} />;
  }

  if (estado === ESTADO_COMPUTADORA.RESERVADA) {
    return <CountdownTexto hasta={liberacionEn} prefijo="Se libera si no la retiran en" umbralUrgente={300} />;
  }

  return null;
}

export function ComputadoraCard({ computadora, onReservar, puedeReservar = false, motivoBloqueo = null, esMia = false }) {
  const meta = META_ESTADO_COMPUTADORA[computadora.estado] ?? META_ESTADO_COMPUTADORA.MANTENIMIENTO;
  const esReservable = computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE;

  return (
    <article
      className={`tarjeta flex flex-col gap-4 p-5 transition ${meta.borde} ${
        computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE ? 'hover:shadow-md' : ''
      }`}
    >
      {/* Encabezado: código + estado ------------------------------------- */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Cpu className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-sm font-semibold tracking-tight text-slate-900">
              {computadora.codigo_inventario}
            </p>
            <p className="text-xs text-slate-500">Equipo de laboratorio</p>
          </div>
        </div>
        <BadgeComputadora estado={computadora.estado} />
      </div>

      {/* Modelo y especificaciones --------------------------------------- */}
      <div className="space-y-1">
        <p className="text-base font-semibold leading-snug text-slate-800">{computadora.modelo}</p>
        {computadora.especificaciones && (
          <p className="line-clamp-2 text-xs text-slate-500">{computadora.especificaciones}</p>
        )}
      </div>

      {/* Disponibilidad --------------------------------------------------- */}
      <div className="mt-auto space-y-3">
        <div className="min-h-[22px]">
          {esMia ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-marca-700">
              <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
              Es tu equipo actual
            </span>
          ) : (
            <TextoTiempo computadora={computadora} />
          )}
        </div>

        {esReservable ? (
          <Button
            className="w-full"
            Icono={Sparkles}
            disabled={!puedeReservar}
            title={motivoBloqueo ?? 'Reservar esta computadora'}
            onClick={() => onReservar?.(computadora)}
          >
            {puedeReservar ? 'Reservar ahora' : 'No disponible para reservar'}
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {meta.descripcion}
          </div>
        )}

        {esReservable && !puedeReservar && motivoBloqueo && (
          <p className="text-xs text-amber-600">{motivoBloqueo}</p>
        )}

        {computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
            Fuera de servicio por mantenimiento técnico
          </p>
        )}
      </div>
    </article>
  );
}
