/**
 * =============================================================================
 *  DashboardSecretarioPage - /admin
 * =============================================================================
 *  Panel de mostrador:
 *   1. Métricas del inventario y de la cola de préstamos.
 *   2. Validación del PIN (check-in) en un solo paso.
 *   3. Cola de préstamos vigentes con acciones (recibir equipo / cancelar).
 *   4. Inventario completo con tiempo restante por equipo.
 *   5. Sprint 3: recepción física con comentarios del alumno, historial por
 *      equipo (trazabilidad) y alta/baja manual de mantenimiento.
 *
 *  Todo se actualiza por Socket.io: cuando un alumno reserva desde su celular,
 *  el equipo aparece acá al instante sin recargar.
 * =============================================================================
 */

import { useCallback, useMemo, useState } from 'react';
import {
  CheckCheck,
  ClipboardCheck,
  Cpu,
  MonitorCheck,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { CheckInPanel } from '../components/prestamos/CheckInPanel.jsx';
import { TablaPrestamos } from '../components/prestamos/TablaPrestamos.jsx';
import { ListaEquiposAdmin } from '../components/computadoras/ListaEquiposAdmin.jsx';
import { HistorialEquipoModal } from '../components/computadoras/HistorialEquipoModal.jsx';
import { DevolucionModal } from '../components/prestamos/DevolucionModal.jsx';
import { Alert } from '../components/ui/Feedback.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { TarjetaMetrica } from '../components/ui/TarjetaMetrica.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComputadoras } from '../hooks/useComputadoras.js';
import { usePrestamosVigentes } from '../hooks/usePrestamosVigentes.js';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import {
  cancelarPrestamoRequest,
  checkInRequest,
} from '../api/prestamos.api.js';
import { cambiarEstadoComputadoraRequest } from '../api/computadoras.api.js';
import { ESTADO_COMPUTADORA } from '../constants/estados.js';
import { formatearHora } from '../utils/format.js';

export function DashboardSecretarioPage() {
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
    prestamos,
    pendientes,
    activos,
    cargando: cargandoPrestamos,
    error: errorPrestamos,
    recargar: recargarPrestamos,
    quitarPrestamo,
  } = usePrestamosVigentes();

  // --- Acciones ------------------------------------------------------------
  const checkIn = useAsyncAction(checkInRequest);
  const cancelar = useAsyncAction(cancelarPrestamoRequest);
  const cambioEstado = useAsyncAction(cambiarEstadoComputadoraRequest);

  // Se extraen las funciones estables de cada acción: así los callbacks tienen
  // identidad constante y no fuerzan re-renders ni re-suscripciones innecesarias.
  const { ejecutar: ejecutarCheckIn } = checkIn;
  const { ejecutar: ejecutarCancelar } = cancelar;
  const { ejecutar: ejecutarCambioEstado } = cambioEstado;

  const [filaEnProceso, setFilaEnProceso] = useState(null);
  const [pcEnProceso, setPcEnProceso] = useState(null);
  const [aviso, setAviso] = useState(null);

  // --- Estados de los modales del Sprint 3 ---------------------------------
  const [prestamoARecibir, setPrestamoARecibir] = useState(null);
  const [recepcionAbierta, setRecepcionAbierta] = useState(false);
  const [computadoraHistorial, setComputadoraHistorial] = useState(null);
  const [pcFueraDeServicio, setPcFueraDeServicio] = useState(null);

  /** Validación del PIN: el resultado queda en `checkIn.resultado` para el panel. */
  const validarPin = useCallback(
    async (pin) => {
      const resultado = await ejecutarCheckIn({ token: pin });
      if (resultado) {
        setAviso({
          variante: 'exito',
          texto: `Check-in registrado: ${resultado.prestamo.usuario.nombre} ${resultado.prestamo.usuario.apellido} retira ${resultado.prestamo.computadora.codigo_inventario} (devolución ${formatearHora(resultado.prestamo.fecha_hora_fin_estimada)}).`,
        });
      }
      return resultado;
    },
    [ejecutarCheckIn],
  );

  /** Recepción física: abre el modal donde se ven los comentarios del alumno. */
  const manejarRecibir = useCallback((prestamo) => {
    setPrestamoARecibir(prestamo);
    setRecepcionAbierta(true);
  }, []);

  /** US-06/US-08: confirmación del mostrador registrada (con o sin reporte). */
  const alRecibir = useCallback(
    (resultado) => {
      quitarPrestamo(resultado.prestamo.id);
      fusionarComputadora(resultado.computadora);
      // El modal queda abierto mostrando la confirmación; lo cierra la
      // secretaría con "Entendido".
      setAviso({
        variante: resultado.computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO ? 'aviso' : 'exito',
        texto:
          resultado.computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO
            ? `Equipo recibido con falla: ${resultado.prestamo.computadora?.codigo_inventario} quedó en mantenimiento.`
            : `Equipo recibido: ${resultado.prestamo.computadora?.codigo_inventario} quedó disponible.`,
      });
      void recargarCatalogo({ silencioso: true });
      void recargarPrestamos({ silencioso: true });
    },
    [quitarPrestamo, fusionarComputadora, recargarCatalogo, recargarPrestamos],
  );

  /** Aplica un cambio manual de estado (MANTENIMIENTO <-> DISPONIBLE). */
  const aplicarEstado = useCallback(
    async (computadora, estado) => {
      setPcEnProceso(computadora.id);
      const resultado = await ejecutarCambioEstado({ id: computadora.id, estado });
      setPcEnProceso(null);

      if (resultado) {
        fusionarComputadora(resultado.computadora);
        setAviso({
          variante: estado === ESTADO_COMPUTADORA.MANTENIMIENTO ? 'aviso' : 'exito',
          texto:
            estado === ESTADO_COMPUTADORA.MANTENIMIENTO
              ? `${computadora.codigo_inventario} salió de servicio${resultado.computadora.prestamo_activo ? '' : ': sus reportes quedaron pendientes de reparación'}.`
              : `${computadora.codigo_inventario} volvió al inventario: sus reportes abiertos quedaron resueltos.`,
        });
        void recargarCatalogo({ silencioso: true });
        void recargarPrestamos({ silencioso: true });
      }
    },
    [ejecutarCambioEstado, fusionarComputadora, recargarCatalogo, recargarPrestamos],
  );

  /**
   * Mantenimiento manual: sacar de servicio pide confirmación (es una acción
   * de impacto); reintegrar se aplica directamente porque es reversible.
   */
  const manejarEstado = useCallback(
    (computadora) => {
      if (computadora.estado === ESTADO_COMPUTADORA.DISPONIBLE) {
        setPcFueraDeServicio(computadora);
        return;
      }
      if (computadora.estado === ESTADO_COMPUTADORA.MANTENIMIENTO) {
        void aplicarEstado(computadora, ESTADO_COMPUTADORA.DISPONIBLE);
      }
    },
    [aplicarEstado],
  );

  const confirmarFueraDeServicio = async () => {
    if (!pcFueraDeServicio) return;
    const computadora = pcFueraDeServicio;
    setPcFueraDeServicio(null);
    await aplicarEstado(computadora, ESTADO_COMPUTADORA.MANTENIMIENTO);
  };

  const manejarCancelar = useCallback(
    async (prestamo) => {
      setFilaEnProceso(prestamo.id);
      const resultado = await ejecutarCancelar(prestamo.id);
      setFilaEnProceso(null);

      if (resultado) {
        quitarPrestamo(prestamo.id);
        setAviso({
          variante: 'aviso',
          texto: `Reserva cancelada: ${prestamo.computadora?.codigo_inventario} volvió a estar disponible.`,
        });
      }
    },
    [ejecutarCancelar, quitarPrestamo],
  );

  /** Error de la última acción de fila o del inventario. */
  const errorAcciones = useMemo(
    () => cambioEstado.errorMensaje ?? cancelar.errorMensaje ?? null,
    [cambioEstado.errorMensaje, cancelar.errorMensaje],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ================= Encabezado ================================= */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Panel de secretaría</h1>
            <p className="mt-1 text-sm text-slate-500">
              Bienvenida {usuario?.nombre ?? ''}. Validá los PIN de retiro y administrá los equipos del
              laboratorio.
            </p>
          </div>

          <Button
            variante="secundario"
            Icono={RefreshCw}
            cargando={cargandoCatalogo || cargandoPrestamos}
            onClick={() => {
              void recargarCatalogo();
              void recargarPrestamos();
            }}
          >
            Actualizar datos
          </Button>
        </header>

        {/* ================= Avisos ===================================== */}
        {aviso && (
          <Alert
            variante={aviso.variante}
            className="animate-fade-in"
          >
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

        {errorPrestamos && (
          <Alert variante="error" titulo="No se pudo cargar la cola de préstamos">
            {errorPrestamos}
          </Alert>
        )}

        {errorCatalogo && computadoras.length === 0 && (
          <Alert variante="error" titulo="No se pudo cargar el inventario">
            {errorCatalogo}
          </Alert>
        )}

        {errorAcciones && <Alert variante="error" titulo="La operación no se pudo completar">{errorAcciones}</Alert>}

        {/* ================= Métricas =================================== */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaMetrica
            Icono={Sparkles}
            etiqueta="Disponibles"
            valor={resumen.DISPONIBLE ?? 0}
            color="emerald"
            detalle="Listas para asignar"
          />
          <TarjetaMetrica
            Icono={Cpu}
            etiqueta="Reservadas"
            valor={resumen.RESERVADA ?? 0}
            color="amber"
            detalle="Esperando retiro con PIN"
          />
          <TarjetaMetrica
            Icono={MonitorCheck}
            etiqueta="En uso"
            valor={resumen.EN_USO ?? 0}
            color="rose"
            detalle="Con préstamo activo"
          />
          <TarjetaMetrica
            Icono={TriangleAlert}
            etiqueta="Mantenimiento"
            valor={resumen.MANTENIMIENTO ?? 0}
            color="slate"
            detalle="Fuera de servicio"
          />
        </section>

        {/* ================= Check-in + cola ============================ */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Validación del PIN ------------------------------------------- */}
          <section className="tarjeta h-fit p-5">
            <header className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-50 text-marca-600">
                <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Check-in por PIN</h2>
                <p className="text-xs text-slate-500">Entrega del equipo al alumno</p>
              </div>
            </header>

            <CheckInPanel
              onValidar={validarPin}
              enProceso={checkIn.enProceso}
              error={checkIn.errorMensaje}
              exito={checkIn.resultado}
              onLimpiar={checkIn.reiniciar}
            />

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center">
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Por retirar</p>
                <p className="text-xl font-semibold text-amber-800 cifras-fijas">{pendientes.length}</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">En uso</p>
                <p className="text-xl font-semibold text-indigo-800 cifras-fijas">{activos.length}</p>
              </div>
            </div>
          </section>

          {/* Cola de préstamos ------------------------------------------ */}
          <div className="space-y-4 lg:col-span-2">
            <TablaPrestamos
              prestamos={prestamos}
              onRecibir={manejarRecibir}
              onCancelar={manejarCancelar}
              idEnProceso={filaEnProceso}
              titulo="Reservas y préstamos en curso"
              vacio="No hay reservas pendientes de retiro ni préstamos activos."
            />

            {cargandoPrestamos && (
              <p className="text-center text-xs text-slate-400">Actualizando la cola de préstamos...</p>
            )}
          </div>
        </div>

        {/* ================= Inventario ================================= */}
        <section className="tarjeta overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Cpu className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Inventario y tiempos
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              {resumen.total ?? 0} equipos registrados · actualización en vivo
            </span>
          </header>

          {cargandoCatalogo ? (
            <p className="p-6 text-center text-sm text-slate-500">Cargando inventario...</p>
          ) : (
            <ListaEquiposAdmin
              computadoras={computadoras}
              onVerHistorial={setComputadoraHistorial}
              onCambiarEstado={manejarEstado}
              idEnProceso={pcEnProceso}
            />
          )}
        </section>
      </div>

      {/* ================= Modales ========================================= */}

      {/* US-06/US-08: recepción física con comentarios y reporte opcional. */}
      <DevolucionModal
        prestamo={prestamoARecibir}
        abierta={recepcionAbierta}
        rol="SECRETARIO"
        onCerrar={() => {
          setRecepcionAbierta(false);
          setPrestamoARecibir(null);
        }}
        onDevuelto={alRecibir}
      />

      {/* Trazabilidad: quiénes usaron el equipo y qué fallas se reportaron. */}
      <HistorialEquipoModal
        computadora={computadoraHistorial}
        abierta={Boolean(computadoraHistorial)}
        onCerrar={() => setComputadoraHistorial(null)}
      />

      {/* Mantenimiento manual: confirmación al sacar un equipo de servicio. */}
      <Modal
        abierta={Boolean(pcFueraDeServicio)}
        onCerrar={() => setPcFueraDeServicio(null)}
        cerrarConFondo={!cambioEstado.enProceso}
        ocultarCerrar={cambioEstado.enProceso}
        ancho="sm"
        titulo="Sacar equipo de servicio"
        descripcion={`${pcFueraDeServicio?.codigo_inventario ?? ''} · ${pcFueraDeServicio?.modelo ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            El equipo quedará en <strong>MANTENIMIENTO</strong> y no podrá reservarse ni prestarse
            hasta que se lo reintegre al inventario. Su historial y sus fallas quedan registrados
            para trazabilidad.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variante="secundario"
              onClick={() => setPcFueraDeServicio(null)}
              disabled={cambioEstado.enProceso}
            >
              Volver
            </Button>
            <Button
              variante="peligro"
              Icono={TriangleAlert}
              cargando={cambioEstado.enProceso}
              onClick={() => void confirmarFueraDeServicio()}
            >
              {cambioEstado.enProceso ? 'Aplicando...' : 'Sí, sacar de servicio'}
            </Button>
          </div>

          {cambioEstado.errorMensaje && (
            <Alert variante="error" detalles={cambioEstado.detallesError}>
              {cambioEstado.errorMensaje}
            </Alert>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
