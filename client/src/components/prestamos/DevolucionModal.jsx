/**
 * =============================================================================
 *  DevolucionModal - Devolución con feedback (US-06) y reporte de fallas (US-08)
 * =============================================================================
 *  Un mismo modal para los dos actores que pueden cerrar un préstamo:
 *   - ALUMNO (rol="ALUMNO"): "Devolver equipo" desde su dashboard.
 *   - SECRETARIO (rol="SECRETARIO"): "Recibir equipo" en el mostrador; si el
 *     alumno dejó comentarios o daños pre-registrados, se muestran arriba del
 *     formulario antes de confirmar la recepción física.
 *
 *  Dos pasos:
 *   1. "form": observaciones opcionales + indicador de problemas técnicos con
 *      severidad (LEVE/GRAVE/CRITICA) y descripción obligatoria si hay falla.
 *   2. "ok":   confirmación con el estado resultante del equipo (si la falla
 *      fue GRAVE o CRITICA, el backend la derivó a MANTENIMIENTO).
 * =============================================================================
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, TriangleAlert } from 'lucide-react';
import { devolverPrestamoRequest } from '../../api/prestamos.api.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { REGLAS } from '../../constants/reglas.js';
import { META_SEVERIDAD_FALLA, SEVERIDAD_FALLA } from '../../constants/estados.js';
import { formatearHora } from '../../utils/format.js';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Badge } from '../ui/Badge.jsx';

export function DevolucionModal({ prestamo, abierta, onCerrar, onDevuelto, rol = 'ALUMNO' }) {
  const esSecretario = rol === 'SECRETARIO';

  const [observaciones, setObservaciones] = useState('');
  const [huboFalla, setHuboFalla] = useState(false);
  const [severidad, setSeveridad] = useState(SEVERIDAD_FALLA.LEVE);
  const [descripcionFalla, setDescripcionFalla] = useState('');
  const [errorValidacion, setErrorValidacion] = useState(null);
  const [resultado, setResultado] = useState(null);
  // Copia del préstamo que se está atendiendo: el padre puede vaciar su prop
  // (p. ej. setVigente(null)) apenas se registra la devolución y el modal
  // debe poder mostrar igualmente el paso de confirmación.
  const [prestamoAtendido, setPrestamoAtendido] = useState(null);

  const { ejecutar, enProceso, errorMensaje, detallesError, reiniciar } = useAsyncAction(
    (payload) => devolverPrestamoRequest((prestamo ?? prestamoAtendido)?.id, payload),
  );

  // --- Reset al abrir --------------------------------------------------------
  // Solo depende de `abierta`: un cambio de la prop `prestamo` durante el paso
  // de éxito (por la actualización del padre) no debe reventar el resultado.
  useEffect(() => {
    if (!abierta) return;
    setObservaciones('');
    setHuboFalla(false);
    setSeveridad(SEVERIDAD_FALLA.LEVE);
    setDescripcionFalla('');
    setErrorValidacion(null);
    setResultado(null);
    setPrestamoAtendido(null);
    reiniciar();
  }, [abierta, reiniciar]);

  const prestamoMostrado = prestamoAtendido ?? prestamo;

  // Si mientras el modal está abierto el préstamo dejó de existir en el padre
  // (p. ej. la secretaría lo finalizó desde otra pestaña) y no hay nada en
  // curso, se cierra solo para no dejar la UI en un estado huérfano.
  useEffect(() => {
    if (abierta && !prestamoMostrado) onCerrar?.();
  }, [abierta, prestamoMostrado, onCerrar]);

  const cerrar = () => {
    if (enProceso) return;
    onCerrar?.();
  };

  /** Validación local + envío. */
  const confirmar = async () => {
    setErrorValidacion(null);

    if (huboFalla && descripcionFalla.trim().length < 10) {
      setErrorValidacion('Describí la falla con al menos 10 caracteres para poder darla de alta.');
      return;
    }

    if (observaciones.length > REGLAS.maximoObservaciones) {
      setErrorValidacion(`Las observaciones no pueden superar los ${REGLAS.maximoObservaciones} caracteres.`);
      return;
    }

    const payload = {
      observaciones: observaciones.trim() ? observaciones.trim() : null,
      reporte: huboFalla
        ? { severidad, descripcion: descripcionFalla.trim() }
        : null,
    };

    // Se fija el préstamo antes de enviar: durante el envío el padre puede
    // vaciar su estado y necesitamos el objeto para el paso de éxito.
    setPrestamoAtendido(prestamo);

    const respuesta = await ejecutar(payload);

    if (respuesta) {
      setResultado(respuesta);
      onDevuelto?.(respuesta);
    }
  };

  if (!prestamoMostrado) return null;

  const enPasoExito = Boolean(resultado);
  const equipo = prestamoMostrado.computadora ?? {};
  // Comentarios/daños que el alumno pudo haber dejado antes de la recepción.
  const observacionesPrevias = prestamoMostrado.observaciones_devolucion;
  const reportesPrevios = prestamoMostrado.reportes ?? [];

  return (
    <Modal
      abierta={abierta}
      onCerrar={cerrar}
      ocultarCerrar={enProceso}
      cerrarConFondo={!enPasoExito && !enProceso}
      ancho="md"
      titulo={
        enPasoExito
          ? 'Devolución registrada'
          : esSecretario
            ? 'Recibir equipo'
            : 'Devolver equipo'
      }
      descripcion={
        enPasoExito
          ? 'El préstamo quedó cerrado y el equipo se actualizó en el inventario.'
          : `${equipo.codigo_inventario ?? ''} · ${prestamoMostrado.usuario?.nombre ?? ''} ${prestamoMostrado.usuario?.apellido ?? ''}`
      }
    >
      {/* ================= PASO 2: confirmación ========================= */}
      {enPasoExito ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              {resultado.prestamo.computadora?.codigo_inventario} devuelto a las{' '}
              {formatearHora(resultado.prestamo.fecha_hora_fin_real)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Estado del equipo:{' '}
              <strong>
                {resultado.computadora.estado === 'MANTENIMIENTO' ? 'MANTENIMIENTO' : 'DISPONIBLE'}
              </strong>
            </p>
          </div>

          {resultado.reporte && (
            <Alert variante={resultado.reporte.severidad === SEVERIDAD_FALLA.LEVE ? 'info' : 'aviso'} titulo="Reporte de falla registrado">
              <p className="flex flex-wrap items-center gap-2">
                <Badge
                  clase={META_SEVERIDAD_FALLA[resultado.reporte.severidad]?.insignia}
                  punto={META_SEVERIDAD_FALLA[resultado.reporte.severidad]?.punto}
                >
                  {META_SEVERIDAD_FALLA[resultado.reporte.severidad]?.etiqueta}
                </Badge>
                <span>{resultado.reporte.descripcion}</span>
              </p>
              {resultado.computadora.estado === 'MANTENIMIENTO' && (
                <p className="mt-2 text-xs">
                  Por la severidad reportada, el equipo quedó fuera de servicio hasta su reparación.
                </p>
              )}
            </Alert>
          )}

          <Button variante="primario" className="w-full" Icono={PackageCheck} onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      ) : (
        /* ================= PASO 1: formulario ========================== */
        <div className="space-y-5">
          {/* Resumen del préstamo ------------------------------------- */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Equipo</dt>
              <dd className="font-mono font-semibold text-slate-800">{equipo.codigo_inventario}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
              <dt className="text-xs text-slate-500">Devolución estimada</dt>
              <dd className="font-semibold text-slate-800">
                {formatearHora(prestamoMostrado.fecha_hora_fin_estimada)}
              </dd>
            </div>
          </dl>

          {/* Lo que el alumno ya registró (lo ve la secretaría) --------- */}
          {esSecretario && (observacionesPrevias || reportesPrevios.length > 0) && (
            <Alert variante="info" titulo="Comentarios del alumno">
              {observacionesPrevias && <p className="text-sm">{observacionesPrevias}</p>}
              {reportesPrevios.map((reporte) => (
                <p key={reporte.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge
                    clase={META_SEVERIDAD_FALLA[reporte.severidad]?.insignia}
                    punto={META_SEVERIDAD_FALLA[reporte.severidad]?.punto}
                  >
                    {META_SEVERIDAD_FALLA[reporte.severidad]?.etiqueta ?? reporte.severidad}
                  </Badge>
                  <span>{reporte.descripcion}</span>
                </p>
              ))}
            </Alert>
          )}

          {/* Observaciones ---------------------------------------------- */}
          <div>
            <label htmlFor="observaciones-devolucion" className="etiqueta">
              Observaciones {esSecretario ? 'de la recepción' : '(opcional)'}
            </label>
            <textarea
              id="observaciones-devolucion"
              rows={3}
              maxLength={REGLAS.maximoObservaciones}
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              placeholder="Ej.: se entregó limpio y con todos los accesorios."
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30"
            />
            <p className="texto-ayuda">
              {observaciones.length}/{REGLAS.maximoObservaciones} caracteres
            </p>
          </div>

          {/* Problemas técnicos ----------------------------------------- */}
          <div className="rounded-2xl border border-slate-200 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={huboFalla}
                onChange={(evento) => setHuboFalla(evento.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-marca-600 focus:ring-marca-500/30"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                  <TriangleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  ¿Tuviste problemas con el equipo?
                </span>
                <span className="text-xs text-slate-500">
                  Si la falla es grave o crítica, la computadora pasa a mantenimiento automáticamente.
                </span>
              </span>
            </label>

            {huboFalla && (
              <div className="mt-4 space-y-4 animate-fade-in">
                <fieldset>
                  <legend className="etiqueta">Severidad</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(META_SEVERIDAD_FALLA).map(([valor, meta]) => {
                      const activa = severidad === valor;
                      return (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => setSeveridad(valor)}
                          aria-pressed={activa}
                          className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                            activa
                              ? `${meta.borde} ${meta.fondo} ${meta.texto} ring-1 ring-current`
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {meta.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                  <p className="texto-ayuda">{META_SEVERIDAD_FALLA[severidad]?.descripcion}</p>
                </fieldset>

                <div>
                  <label htmlFor="descripcion-falla" className="etiqueta">
                    Descripción de la falla <span className="ml-0.5 text-rose-500">*</span>
                  </label>
                  <textarea
                    id="descripcion-falla"
                    rows={3}
                    maxLength={500}
                    value={descripcionFalla}
                    onChange={(evento) => setDescripcionFalla(evento.target.value)}
                    placeholder="Ej.: la pantalla parpadea al abrir varias ventanas."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30"
                  />
                  <p className="texto-ayuda">{descripcionFalla.length}/500 caracteres (mínimo 10)</p>
                </div>
              </div>
            )}
          </div>

          {errorValidacion && <Alert variante="error">{errorValidacion}</Alert>}

          {errorMensaje && (
            <Alert variante="error" titulo="No se pudo registrar la devolución" detalles={detallesError}>
              {errorMensaje}
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variante="secundario" onClick={cerrar} disabled={enProceso}>
              Volver
            </Button>
            <Button
              variante="exito"
              Icono={PackageCheck}
              onClick={confirmar}
              cargando={enProceso}
            >
              {enProceso ? 'Registrando...' : esSecretario ? 'Confirmar recepción' : 'Entregar equipo'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
