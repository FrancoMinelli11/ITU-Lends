/**
 * =============================================================================
 *  DashboardAlumnoPage - /dashboard
 * =============================================================================
 *  Compone la vista del alumno:
 *   1. Su préstamo vigente (PIN / tiempo restante) o el aviso de que está libre.
 *   2. Catálogo interactivo con estados y contadores en vivo.
 *   3. Historial reciente.
 *   4. Modal de reserva (inmediata o programada) con el PIN resultante.
 *   5. Sprint 3: alerta flotante a los 15 min, extensión +60 min y modal de
 *      devolución con observaciones y reporte de fallas.
 *
 *  La página no habla con la API directamente: usa los hooks de datos
 *  (useComputadoras, useMisPrestamos) y de acciones (useAsyncAction).
 * =============================================================================
 */

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, Cpu, History, MonitorCheck, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { ComputadoraGrid } from '../components/computadoras/ComputadoraGrid.jsx';
import { MiReservaCard } from '../components/prestamos/MiReservaCard.jsx';
import { ReservaModal } from '../components/prestamos/ReservaModal.jsx';
import { HistorialPrestamos } from '../components/prestamos/HistorialPrestamos.jsx';
import { AlertaVencimiento } from '../components/prestamos/AlertaVencimiento.jsx';
import { DevolucionModal } from '../components/prestamos/DevolucionModal.jsx';
import { Alert } from '../components/ui/Feedback.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { CargandoBloque } from '../components/ui/Spinner.jsx';
import { TarjetaMetrica } from '../components/ui/TarjetaMetrica.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComputadoras } from '../hooks/useComputadoras.js';
import { useMisPrestamos } from '../hooks/useMisPrestamos.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { cancelarPrestamoRequest, extenderPrestamoRequest } from '../api/prestamos.api.js';
import { ESTADO_COMPUTADORA } from '../constants/estados.js';
import { REGLAS } from '../constants/reglas.js';
import { formatearHora } from '../utils/format.js';

export function DashboardAlumnoPage() {
  const { usuario } = useAuth();

  // --- Datos ---------------------------------------------------------------
  const {
    computadoras,
    resumen,
    cargando: cargandoCatalogo,
    error: errorCatalogo,
    recargar: recargarCatalogo,
    fusionarComputadora,
  } = useComputadoras();

  const {
    vigente,
    historial,
    cargando: cargandoMisPrestamos,
    error: errorMisPrestamos,
    recargar: recargarMisPrestamos,
    setVigente,
  } = useMisPrestamos();

  // --- UI local ------------------------------------------------------------
  const [computadoraElegida, setComputadoraElegida] = useState(null);
  const [prestamoACancelar, setPrestamoACancelar] = useState(null);
  const [devolucionAbierta, setDevolucionAbierta] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cancelacion = useAsyncAction(cancelarPrestamoRequest);
  const extension = useAsyncAction(extenderPrestamoRequest);
  const { ejecutar: ejecutarExtension } = extension;

  // --- Derivados -----------------------------------------------------------
  const misEquipos = useMemo(() => {
    const ids = new Set();
    if (vigente?.computadora?.id) ids.add(vigente.computadora.id);
    return ids;
  }, [vigente]);

  const puedeReservar = useCallback(
    (computadora) => !vigente && computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE,
    [vigente],
  );

  const motivoBloqueo = useCallback(
    (computadora) => {
      if (vigente && computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE) {
        return `Ya tenés un préstamo vigente (${vigente.computadora?.codigo_inventario}). Devolvelo o cancelá la reserva para solicitar otro equipo.`;
      }
      return null;
    },
    [vigente],
  );

  // --- Acciones ------------------------------------------------------------
  const alReservar = useCallback(
    (resultado) => {
      // Patch inmediato del equipo reservado + del préstamo propio.
      fusionarComputadora(resultado.computadora);
      setVigente(resultado.prestamo);
    },
    [fusionarComputadora, setVigente],
  );

  const confirmarCancelacion = async () => {
    if (!prestamoACancelar) return;
    const resultado = await cancelacion.ejecutar(prestamoACancelar.id);
    if (resultado) {
      setVigente(null);
      setPrestamoACancelar(null);
      // El evento de socket también actualiza el catálogo; esta recarga es por
      // si el cliente estuvo desconectado en ese instante.
      void recargarCatalogo({ silencioso: true });
      void recargarMisPrestamos({ silencioso: true });
    }
  };

  /** US-05: extiende el préstamo activo +60 min y refresca vista y catálogo. */
  const alExtender = useCallback(async () => {
    if (!vigente) return;
    const resultado = await ejecutarExtension(vigente.id);
    if (!resultado) return;

    setVigente(resultado.prestamo);
    fusionarComputadora(resultado.computadora);
    setAviso({
      variante: 'exito',
      texto: `Préstamo extendido +${REGLAS.extensionMinutos} minutos: nueva devolución a las ${formatearHora(resultado.prestamo.fecha_hora_fin_estimada)}.`,
    });
  }, [vigente, ejecutarExtension, setVigente, fusionarComputadora]);

  /** US-06/US-08: la devolución fue registrada desde el modal. */
  const alDevolver = useCallback(
    (resultado) => {
      // El modal se mantiene abierto para mostrar el paso de éxito; lo cierra
      // el alumno con "Entendido" (onCerrar del DevolucionModal).
      setVigente(null);
      fusionarComputadora(resultado.computadora);
      setAviso({
        variante: 'exito',
        texto:
          resultado.computadora.estado === 'MANTENIMIENTO'
            ? 'Devolución registrada: por la falla reportada, el equipo quedó en mantenimiento.'
            : 'Devolución registrada: el equipo volvió a estar disponible.',
      });
      void recargarCatalogo({ silencioso: true });
      void recargarMisPrestamos({ silencioso: true });
    },
    [setVigente, fusionarComputadora, recargarCatalogo, recargarMisPrestamos],
  );

  const nombre = usuario?.nombre ?? '';

  return (
    <AppShell>
      {/* Aviso flotante de vencimiento (Sprint 3): 15 min antes de cerrar. */}
      <AlertaVencimiento prestamo={vigente} />

      <div className="space-y-6">
        {/* ================= Encabezado ================================= */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Hola{nombre ? `, ${nombre}` : ''} 👋
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Elegí una computadora disponible y reservala en segundos. Vas a recibir un PIN para
              retirarla en secretaría.
            </p>
          </div>

          <Button
            variante="secundario"
            Icono={RefreshCw}
            onClick={() => {
              void recargarCatalogo();
              void recargarMisPrestamos();
            }}
            cargando={cargandoCatalogo}
          >
            Actualizar
          </Button>
        </header>

        {errorCatalogo && computadoras.length > 0 && (
          <Alert variante="error" titulo="No pudimos actualizar el catálogo">
            {errorCatalogo} Seguís viendo la última información recibida.
          </Alert>
        )}

        {/* ================= Mi préstamo vigente ======================== */}
        {cargandoMisPrestamos ? (
          <div className="tarjeta">
            <CargandoBloque mensaje="Consultando tu préstamo actual..." />
          </div>
        ) : vigente ? (
          <MiReservaCard
            prestamo={vigente}
            onCancelar={setPrestamoACancelar}
            cancelando={cancelacion.enProceso}
            onExtender={alExtender}
            exteniendo={extension.enProceso}
            onDevolver={() => setDevolucionAbierta(true)}
          />
        ) : (
          <div className="tarjeta flex flex-wrap items-center gap-3 border-dashed p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MonitorCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">No tenés préstamos activos</p>
              <p className="text-xs text-slate-500">
                Podés reservar cualquiera de los {resumen[ESTADO_COMPUTADORA.DISPONIBLE] ?? 0} equipos
                disponibles ahora mismo.
              </p>
            </div>
            {resumen[ESTADO_COMPUTADORA.DISPONIBLE] > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" /> Listo para reservar
              </span>
            )}
          </div>
        )}

        {errorMisPrestamos && <Alert variante="error">{errorMisPrestamos}</Alert>}

        {aviso && (
          <Alert variante={aviso.variante} className="animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{aviso.texto}</span>
              <button
                type="button"
                onClick={() => setAviso(null)}
                className="text-xs font-medium underline decoration-dotted"
              >
                Cerrar
              </button>
            </div>
          </Alert>
        )}

        {/* US-05: si el backend rechaza la extensión (p. ej. hay otra reserva
            en la hora siguiente), el motivo se muestra claramente. */}
        {extension.errorMensaje && (
          <Alert variante="error" titulo="No se pudo extender el préstamo" detalles={extension.detallesError}>
            {extension.errorMensaje}
          </Alert>
        )}

        {cancelacion.errorMensaje && (
          <Alert variante="error" titulo="No se pudo cancelar la reserva" detalles={cancelacion.detallesError}>
            {cancelacion.errorMensaje}
          </Alert>
        )}

        {/* ================= Métricas rápidas =========================== */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaMetrica
            Icono={Sparkles}
            etiqueta="Disponibles"
            valor={resumen[ESTADO_COMPUTADORA.DISPONIBLE] ?? 0}
            color="emerald"
            detalle="Listas para reservar"
          />
          <TarjetaMetrica
            Icono={Cpu}
            etiqueta="Reservadas"
            valor={resumen[ESTADO_COMPUTADORA.RESERVADA] ?? 0}
            color="amber"
            detalle="Con retiro pendiente"
          />
          <TarjetaMetrica
            Icono={MonitorCheck}
            etiqueta="En uso"
            valor={resumen[ESTADO_COMPUTADORA.EN_USO] ?? 0}
            color="rose"
            detalle="Ocupadas ahora"
          />
          <TarjetaMetrica
            Icono={TriangleAlert}
            etiqueta="Mantenimiento"
            valor={resumen[ESTADO_COMPUTADORA.MANTENIMIENTO] ?? 0}
            color="slate"
            detalle="Fuera de servicio"
          />
        </section>

        {/* ================= Catálogo =================================== */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Catálogo de equipos</h2>
            <span className="text-xs text-slate-500">
              Los estados se actualizan automáticamente en tiempo real
            </span>
          </div>

          <ComputadoraGrid
            computadoras={computadoras}
            cargando={cargandoCatalogo}
            error={computadoras.length === 0 ? errorCatalogo : null}
            onRecargar={recargarCatalogo}
            onReservar={setComputadoraElegida}
            puedeReservar={puedeReservar}
            motivoBloqueo={motivoBloqueo}
            esMia={(computadora) => misEquipos.has(computadora.id)}
          />
        </section>

        {/* ================= Historial ================================== */}
        <section className="tarjeta">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <History className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Historial reciente
            </h2>
            <span className="text-xs text-slate-500">Últimos 8 movimientos</span>
          </header>
          <div className="px-5 py-2">
            {cargandoMisPrestamos ? (
              <CargandoBloque mensaje="Cargando historial..." />
            ) : (
              <HistorialPrestamos prestamos={historial} />
            )}
          </div>
        </section>

        {computadoras.length === 0 && !cargandoCatalogo && (
          <Alert variante="info" titulo="Sin inventario cargado">
            Pedile a secretaría que revise el inventario o ejecutá el seed del backend
            (<code className="rounded bg-slate-100 px-1">npm run db:seed</code>).
          </Alert>
        )}

        {errorCatalogo === null && computadoras.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Tiempos calculados con el reloj del servidor para evitar desfasajes entre dispositivos.
          </p>
        )}
      </div>

      {/* ================= Modales ====================================== */}
      <ReservaModal
        computadora={computadoraElegida}
        abierta={Boolean(computadoraElegida)}
        onCerrar={() => setComputadoraElegida(null)}
        onReservado={alReservar}
      />

      {/* US-06 + US-08: devolución con observaciones y reporte de falla. */}
      <DevolucionModal
        prestamo={vigente}
        abierta={devolucionAbierta}
        rol="ALUMNO"
        onCerrar={() => setDevolucionAbierta(false)}
        onDevuelto={alDevolver}
      />

      <Modal
        abierta={Boolean(prestamoACancelar)}
        onCerrar={() => {
          if (cancelacion.enProceso) return;
          setPrestamoACancelar(null);
          cancelacion.reiniciar();
        }}
        titulo="Cancelar reserva"
        ancho="sm"
      >
        <p className="text-sm text-slate-600">
          ¿Querés cancelar la reserva de{' '}
          <strong className="font-mono">{prestamoACancelar?.computadora?.codigo_inventario}</strong>? La
          computadora volverá a estar disponible para el resto de los alumnos.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variante="secundario"
            onClick={() => setPrestamoACancelar(null)}
            disabled={cancelacion.enProceso}
          >
            Volver
          </Button>
          <Button variante="peligro" cargando={cancelacion.enProceso} onClick={confirmarCancelacion}>
            Sí, cancelar reserva
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
