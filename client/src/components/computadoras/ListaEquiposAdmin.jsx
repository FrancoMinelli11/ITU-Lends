/**
 * =============================================================================
 *  ListaEquiposAdmin - Inventario compacto para secretaría
 * =============================================================================
 *  Una fila por equipo con: código, modelo, estado, tiempo restante (según el
 *  estado), quién lo tiene y las acciones de gestión del Sprint 3:
 *   - Ver historial (trazabilidad de usuarios y fallas).
 *   - Sacar de servicio / reintegrar (mantenimiento manual, solo si el equipo
 *     no está reservado ni en uso).
 *  Se actualiza en vivo por Socket.io.
 * =============================================================================
 */

import { History, Undo2, Wrench } from 'lucide-react';
import { ESTADO_COMPUTADORA, META_ESTADO_COMPUTADORA } from '../../constants/estados.js';
import { formatearHora } from '../../utils/format.js';
import { BadgeComputadora } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/Feedback.jsx';
import { CountdownTexto } from './CountdownTexto.jsx';

function TextoOcupacion({ computadora }) {
  const { estado, prestamo_activo: prestamo, liberacion_en: liberacionEn } = computadora;

  if (!prestamo) {
    return <span className="text-xs text-slate-400">Sin uso registrado</span>;
  }

  const quien = `${prestamo.usuario?.nombre ?? ''} ${prestamo.usuario?.apellido ?? ''}`.trim();

  if (estado === ESTADO_COMPUTADORA.EN_USO) {
    return (
      <div className="space-y-0.5">
        <p className="truncate text-xs text-slate-600">
          En uso por <span className="font-medium">{quien || 'un alumno'}</span>
        </p>
        <CountdownTexto hasta={liberacionEn} prefijo="Devolución:" umbralUrgente={300} />
      </div>
    );
  }

  if (estado === ESTADO_COMPUTADORA.RESERVADA) {
    return (
      <div className="space-y-0.5">
        <p className="truncate text-xs text-slate-600">
          Reservada por <span className="font-medium">{quien || 'un alumno'}</span> · retiro{' '}
          {formatearHora(prestamo.fecha_hora_inicio)}
        </p>
        <CountdownTexto hasta={liberacionEn} prefijo="Expira:" umbralUrgente={300} />
      </div>
    );
  }

  return null;
}

export function ListaEquiposAdmin({ computadoras = [], onVerHistorial, onCambiarEstado, idEnProceso = null }) {
  if (computadoras.length === 0) {
    return (
      <EmptyState
        Icono={History}
        titulo="Sin equipos registrados"
        descripcion="Ejecutá el seed del backend para cargar el inventario de prueba."
      />
    );
  }

  return (
    <ul className="scroll-fino max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
      {computadoras.map((computadora) => {
        const meta = META_ESTADO_COMPUTADORA[computadora.estado] ?? META_ESTADO_COMPUTADORA.MANTENIMIENTO;
        const enAccion = idEnProceso === computadora.id;
        const esDisponible = computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE;
        const esMantenimiento = computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO;
        // Sacar/reintegrar solo tiene sentido para equipos que no están ni
        // reservados ni en uso (para esos hay que cerrar el préstamo antes).
        const puedeCambiarEstado = esDisponible || esMantenimiento;

        return (
          <li key={computadora.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            {/* Barra de color por estado */}
            <span className={`h-10 w-1 shrink-0 rounded-full ${meta.barra}`} aria-hidden="true" />

            <div className="min-w-[130px] flex-1">
              <p className="font-mono text-sm font-semibold text-slate-800">
                {computadora.codigo_inventario}
              </p>
              <p className="truncate text-xs text-slate-500">{computadora.modelo}</p>
            </div>

            <div className="min-w-[160px] flex-1">
              <TextoOcupacion computadora={computadora} />
            </div>

            <BadgeComputadora estado={computadora.estado} />

            {/* Acciones de gestión (Sprint 3) ----------------------------- */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button
                variante="fantasma"
                tamano="sm"
                Icono={History}
                cargando={enAccion}
                onClick={() => onVerHistorial?.(computadora)}
                title={`Historial de ${computadora.codigo_inventario}`}
                aria-label={`Ver historial de ${computadora.codigo_inventario}`}
              >
                <span className="hidden lg:inline">Historial</span>
              </Button>

              {puedeCambiarEstado && (
                <Button
                  variante={esMantenimiento ? 'secundario' : 'peligro'}
                  tamano="sm"
                  Icono={esMantenimiento ? Undo2 : Wrench}
                  cargando={enAccion}
                  onClick={() => onCambiarEstado?.(computadora)}
                  title={
                    esMantenimiento
                      ? `Reintegrar ${computadora.codigo_inventario}`
                      : `Sacar ${computadora.codigo_inventario} de servicio`
                  }
                >
                  <span className="hidden lg:inline">
                    {esMantenimiento ? 'Reintegrar' : 'Sacar de servicio'}
                  </span>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
