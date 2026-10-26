/**
 * =============================================================================
 *  HistorialEquipoModal - Trazabilidad de una máquina (Sprint 3)
 * =============================================================================
 *  Consulta GET /api/computadoras/:id/historial (secretaría) y presenta:
 *   1. Los últimos préstamos en orden cronológico inverso, con el alumno que
 *      usó el equipo, los horarios y las observaciones de devolución.
 *   2. Todas las fallas reportadas con su severidad, estado de resolución y
 *      quién la registró (clave para rastrear a los usuarios previos a una
 *      falla reportada).
 *
 *  La petición se dispara al abrir y se reinicia ante cada equipo distinto;
 *  maneja estados de carga, error y vacío.
 * =============================================================================
 */

import { useEffect, useState } from 'react';
import { History, MonitorX, Wrench } from 'lucide-react';
import { historialComputadoraRequest } from '../../api/computadoras.api.js';
import { mensajeDeError } from '../../api/axiosClient.js';
import { META_SEVERIDAD_FALLA } from '../../constants/estados.js';
import { formatearFechaHora, formatearHora } from '../../utils/format.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert, EmptyState } from '../ui/Feedback.jsx';
import { Badge, BadgeComputadora, BadgePrestamo } from '../ui/Badge.jsx';
import { CargandoBloque } from '../ui/Spinner.jsx';

/** Insignia de severidad con las clases literales del dominio. */
function BadgeSeveridad({ severidad }) {
  const meta = META_SEVERIDAD_FALLA[severidad] ?? META_SEVERIDAD_FALLA.LEVE;
  return (
    <Badge clase={meta.insignia} punto={meta.punto}>
      {meta.etiqueta ?? severidad}
    </Badge>
  );
}

export function HistorialEquipoModal({ computadora, abierta, onCerrar }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!abierta || !computadora) return undefined;

    let vigente = true;
    setDatos(null);
    setError(null);
    setCargando(true);

    historialComputadoraRequest(computadora.id)
      .then((respuesta) => {
        if (vigente) setDatos(respuesta);
      })
      .catch((fallo) => {
        if (vigente) setError(mensajeDeError(fallo));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false; // Evita actualizar estado tras cerrar el modal.
    };
  }, [abierta, computadora?.id]);

  if (!computadora) return null;

  const prestamos = datos?.prestamos ?? [];
  const reportes = datos?.reportes ?? [];

  return (
    <Modal
      abierta={abierta}
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Historial del equipo"
      descripcion={`${computadora.codigo_inventario} · ${computadora.modelo ?? 'CX'}`}
    >
      {cargando ? (
        <CargandoBloque mensaje="Cargando historial y fallas reportadas..." />
      ) : error ? (
        <div className="space-y-4">
          <Alert variante="error" titulo="No se pudo cargar el historial">
            {error}
          </Alert>
          <Button variante="secundario" onClick={onCerrar} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* --- Estado actual ------------------------------------------- */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-200">
            <div className="flex items-center gap-2">
              <BadgeComputadora estado={datos?.computadora?.estado ?? computadora.estado} />
              <span className="text-xs text-slate-500">
                {reportes.filter((reporte) => !reporte.resuelto).length} falla(s) abierta(s)
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {prestamos.length} uso(s) registrado(s)
            </span>
          </div>

          {/* --- Fallas reportadas --------------------------------------- */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Wrench className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Fallas reportadas
            </h3>

            {reportes.length === 0 ? (
              <EmptyState
                Icono={Wrench}
                titulo="Sin fallas registradas"
                descripcion="Nunca se reportaron averías para este equipo."
              />
            ) : (
              <ul className="space-y-2">
                {reportes.map((reporte) => (
                  <li
                    key={reporte.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <BadgeSeveridad severidad={reporte.severidad} />
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            reporte.resuelto
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {reporte.resuelto ? 'Resuelta' : 'Pendiente'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatearFechaHora(reporte.creado_en)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-700">{reporte.descripcion}</p>

                    {reporte.usuario && (
                      <p className="mt-1 text-xs text-slate-500">
                        Reportada por {reporte.usuario.nombre} {reporte.usuario.apellido}
                        {reporte.usuario.dni ? ` · DNI ${reporte.usuario.dni}` : ''}
                        {reporte.prestamo_id ? ' · durante un préstamo' : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* --- Préstamos ----------------------------------------------- */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <History className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Quiénes usaron este equipo
            </h3>

            {prestamos.length === 0 ? (
              <EmptyState
                Icono={MonitorX}
                titulo="Sin usos registrados"
                descripcion="Todavía no hay préstamos asociados a esta computadora."
              />
            ) : (
              <ul className="scroll-fino max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {prestamos.map((prestamo) => (
                  <li key={prestamo.id} className="p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {prestamo.usuario?.nombre} {prestamo.usuario?.apellido}
                        {prestamo.usuario?.dni ? (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            DNI {prestamo.usuario.dni}
                          </span>
                        ) : null}
                      </p>
                      <BadgePrestamo estado={prestamo.estado} />
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Inicio {formatearHora(prestamo.fecha_hora_inicio)}
                      {prestamo.fecha_hora_fin_real
                        ? ` · fin real ${formatearHora(prestamo.fecha_hora_fin_real)}`
                        : ` · fin estimado ${formatearHora(prestamo.fecha_hora_fin_estimada)}`}
                    </p>

                    {prestamo.observaciones_devolucion && (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-medium">Observaciones:</span>{' '}
                        {prestamo.observaciones_devolucion}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button variante="secundario" onClick={onCerrar} className="w-full">
            Cerrar
          </Button>
        </div>
      )}
    </Modal>
  );
}
