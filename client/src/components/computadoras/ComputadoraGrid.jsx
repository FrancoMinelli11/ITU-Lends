/**
 * Grilla de computadoras con filtros rápidos, skeletons y estado vacío.
 * Componente de presentación: el filtrado ocurre en memoria (el catálogo es
 * pequeño) para que reaccione al instante a los cambios que llegan por socket.
 */

import { useMemo, useState } from 'react';
import { MonitorX, RefreshCw, Search } from 'lucide-react';
import { FILTROS_CATALOGO } from '../../constants/estados.js';
import { ComputadoraCard } from './ComputadoraCard.jsx';
import { Button } from '../ui/Button.jsx';
import { EmptyState } from '../ui/Feedback.jsx';
import { SkeletonGrilla } from '../ui/Skeleton.jsx';

export function ComputadoraGrid({
  computadoras = [],
  cargando = false,
  error = null,
  onRecargar,
  onReservar,
  puedeReservar = () => true,
  motivoBloqueo = () => null,
  esMia = () => false,
  filtrosVisibles = true,
}) {
  const [filtro, setFiltro] = useState('TODAS');
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return computadoras.filter((pc) => {
      const coincideEstado = filtro === 'TODAS' || pc.estado === filtro;
      const coincideTexto =
        !texto ||
        pc.codigo_inventario.toLowerCase().includes(texto) ||
        pc.modelo.toLowerCase().includes(texto);
      return coincideEstado && coincideTexto;
    });
  }, [computadoras, filtro, busqueda]);

  // --- Estados de la UI -----------------------------------------------------
  if (cargando) return <SkeletonGrilla cantidad={6} />;

  if (error) {
    return (
      <EmptyState
        Icono={MonitorX}
        titulo="No se pudo cargar el catálogo"
        descripcion={error}
        accion={
          <Button variante="secundario" Icono={RefreshCw} onClick={() => onRecargar?.()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      {filtrosVisibles && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Filtros por estado */}
          <div className="scroll-fino -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTROS_CATALOGO.map((opcion) => {
              const activo = filtro === opcion.valor;
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => setFiltro(opcion.valor)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    activo
                      ? 'bg-marca-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              );
            })}
          </div>

          {/* Búsqueda */}
          <div className="relative sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por código o modelo"
              aria-label="Buscar computadora"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm shadow-sm placeholder:text-slate-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/30"
            />
          </div>
        </div>
      )}

      {filtradas.length === 0 ? (
        <EmptyState
          Icono={MonitorX}
          titulo={computadoras.length === 0 ? 'Todavía no hay equipos cargados' : 'Sin resultados'}
          descripcion={
            computadoras.length === 0
              ? 'Cuando secretaría cargue el inventario, los equipos aparecerán acá automáticamente.'
              : 'Probá con otro filtro o criterio de búsqueda.'
          }
          accion={
            computadoras.length > 0 ? (
              <Button
                variante="secundario"
                onClick={() => {
                  setFiltro('TODAS');
                  setBusqueda('');
                }}
              >
                Limpiar filtros
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((computadora) => (
            <ComputadoraCard
              key={computadora.id}
              computadora={computadora}
              onReservar={onReservar}
              puedeReservar={puedeReservar(computadora)}
              motivoBloqueo={motivoBloqueo(computadora)}
              esMia={esMia(computadora)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
