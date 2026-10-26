/**
 * =============================================================================
 *  TablaPrestamos - Cola de préstamos vigentes para el mostrador
 * =============================================================================
 *  Muestra reservas pendientes de retiro y préstamos activos con sus acciones:
 *   - Recibir equipo (solo ACTIVO): abre la confirmación de recepción física,
 *     donde se ven los comentarios/daños que el alumno haya registrado (Sprint 3).
 *   - Cancelar (solo PENDIENTE_RETIRO): libera la reserva sin retiro.
 *
 *  En pantallas grandes se comporta como tabla; en móvil/tablet, las filas se
 *  apilan verticalmente manteniendo toda la información.
 * =============================================================================
 */

import { CheckCheck, PackageCheck, Trash2, User } from 'lucide-react';
import { ESTADO_PRESTAMO } from '../../constants/estados.js';
import { formatearHora } from '../../utils/format.js';
import { BadgePrestamo } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/Feedback.jsx';
import { CountdownTexto } from '../computadoras/CountdownTexto.jsx';

/** Fecha relevante para el contador según el estado del préstamo. */
function fechaObjetivo(prestamo) {
  return prestamo.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO
    ? prestamo.limite_retiro
    : prestamo.fecha_hora_fin_estimada;
}

function FilaPrestamo({ prestamo, onRecibir, onCancelar, enProceso }) {
  const esPendiente = prestamo.estado === ESTADO_PRESTAMO.PENDIENTE_RETIRO;
  const usuario = prestamo.usuario ?? {};
  const computadora = prestamo.computadora ?? {};

  return (
    <li
      className={`grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] md:items-center ${
        prestamo.vencido ? 'bg-rose-50/40' : ''
      }`}
    >
      {/* Alumno ------------------------------------------------------------ */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {usuario.nombre} {usuario.apellido}
          </p>
          <p className="truncate text-xs text-slate-500">DNI {usuario.dni}</p>
        </div>
      </div>

      {/* Equipo ------------------------------------------------------------ */}
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-slate-800">{computadora.codigo_inventario}</p>
        <p className="truncate text-xs text-slate-500">{computadora.modelo}</p>
      </div>

      {/* Estado + PIN ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <BadgePrestamo estado={prestamo.estado} />
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600" title="PIN de retiro">
          {prestamo.token_validacion}
        </span>
      </div>

      {/* Tiempos ----------------------------------------------------------- */}
      <div className="space-y-0.5">
        <CountdownTexto
          hasta={fechaObjetivo(prestamo)}
          prefijo={esPendiente ? 'Retiro:' : 'Devol.:'}
          umbralUrgente={300}
        />
        <p className="text-xs text-slate-500">
          Inicio {formatearHora(prestamo.fecha_hora_inicio)} · Fin {formatearHora(prestamo.fecha_hora_fin_estimada)}
        </p>
      </div>

      {/* Acciones ---------------------------------------------------------- */}
      <div className="flex gap-2 md:justify-end">
        {esPendiente ? (
          <Button
            variante="secundario"
            tamano="sm"
            Icono={Trash2}
            cargando={enProceso}
            onClick={() => onCancelar?.(prestamo)}
          >
            Cancelar
          </Button>
        ) : (
          <Button
            variante="exito"
            tamano="sm"
            Icono={PackageCheck}
            cargando={enProceso}
            onClick={() => onRecibir?.(prestamo)}
          >
            Recibir equipo
          </Button>
        )}
      </div>
    </li>
  );
}

export function TablaPrestamos({
  prestamos = [],
  onRecibir,
  onCancelar,
  idEnProceso = null,
  titulo = 'Préstamos vigentes',
  vacio = 'No hay préstamos ni reservas en curso.',
}) {
  return (
    <section className="tarjeta overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {prestamos.length} {prestamos.length === 1 ? 'activo' : 'activos'}
        </span>
      </header>

      {prestamos.length === 0 ? (
        <div className="p-4">
          <EmptyState Icono={CheckCheck} titulo="Todo al día" descripcion={vacio} />
        </div>
      ) : (
        <>
          {/* Encabezado de tabla (solo escritorio) */}
          <div className="hidden border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_auto] md:gap-3">
            <span>Alumno</span>
            <span>Equipo</span>
            <span>Estado / PIN</span>
            <span>Tiempos</span>
            <span className="text-right">Acciones</span>
          </div>

          <ul className="scroll-fino max-h-[520px] overflow-y-auto">
            {prestamos.map((prestamo) => (
              <FilaPrestamo
                key={prestamo.id}
                prestamo={prestamo}
                onRecibir={onRecibir}
                onCancelar={onCancelar}
                enProceso={idEnProceso === prestamo.id}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
