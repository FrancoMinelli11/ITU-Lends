/**
 * Indicador del estado del canal de tiempo real (Socket.io).
 * Da feedback explícito al usuario: si el canal se cae, los datos dejan de
 * actualizarse solos y conviene que lo sepa en lugar de asumir que está al día.
 */

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { ESTADO_CONEXION } from '../../constants/eventos.js';
import { useSocket } from '../../context/SocketContext.jsx';

const ESTADOS = {
  [ESTADO_CONEXION.CONECTADO]: {
    etiqueta: 'En vivo',
    clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Icono: Wifi,
    punto: 'bg-emerald-500 animate-pulse',
  },
  [ESTADO_CONEXION.CONECTANDO]: {
    etiqueta: 'Conectando',
    clase: 'bg-slate-100 text-slate-600 ring-slate-200',
    Icono: Loader2,
    punto: 'bg-slate-400',
  },
  [ESTADO_CONEXION.RECONECTANDO]: {
    etiqueta: 'Reconectando',
    clase: 'bg-amber-50 text-amber-700 ring-amber-200',
    Icono: Loader2,
    punto: 'bg-amber-500 animate-pulse',
  },
  [ESTADO_CONEXION.DESCONECTADO]: {
    etiqueta: 'Sin tiempo real',
    clase: 'bg-slate-100 text-slate-500 ring-slate-200',
    Icono: WifiOff,
    punto: 'bg-slate-400',
  },
};

export function IndicadorConexion({ mostrarTexto = true, className = '' }) {
  const { estadoConexion } = useSocket();
  const meta = ESTADOS[estadoConexion] ?? ESTADOS[ESTADO_CONEXION.DESCONECTADO];
  const { Icono } = meta;

  return (
    <span
      title={`Canal de actualizaciones: ${meta.etiqueta}`}
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.clase} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.punto}`} aria-hidden="true" />
      {mostrarTexto && <span className="hidden sm:inline">{meta.etiqueta}</span>}
      <Icono className={`h-3.5 w-3.5 sm:hidden ${estadoConexion !== ESTADO_CONEXION.CONECTADO ? 'animate-spin' : ''}`} />
    </span>
  );
}
