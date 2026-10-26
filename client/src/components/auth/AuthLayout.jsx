/**
 * Layout de las pantallas de autenticación (login y registro).
 * Panel de marca a la izquierda en escritorio; formulario a la derecha.
 */

import { Database, MonitorCheck, Timer, Wifi } from 'lucide-react';
import { config } from '../../config/env.js';

const BENEFICIOS = [
  { Icono: MonitorCheck, titulo: 'Catálogo en vivo', texto: 'Mirá qué equipos están libres en este momento.' },
  { Icono: Timer, titulo: 'Reservas con PIN', texto: 'Reservá y retirá con un código de 4 dígitos.' },
  { Icono: Wifi, titulo: 'Sincronización instantánea', texto: 'Los estados se actualizan sin recargar la página.' },
  { Icono: Database, titulo: 'Sin dobles reservas', texto: 'El servidor valida la disponibilidad en cada operación.' },
];

export function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Panel de marca (oculto en móvil) */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-marca-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-marca-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marca-600 shadow-lg">
              <MonitorCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Préstamo de Computadoras</p>
              <p className="text-xs text-slate-400">{config.nombreFacultad}</p>
            </div>
          </div>

          <h1 className="mt-12 max-w-md text-3xl font-semibold leading-tight">
            Gestioná el uso de los equipos del laboratorio, sin planillas ni conflictos de horarios.
          </h1>
          <p className="mt-4 max-w-md text-sm text-slate-400">
            Sistema de reserva y validación presencial para alumnos y secretaría académica.
          </p>
        </div>

        <ul className="relative grid max-w-md gap-4 sm:grid-cols-2">
          {BENEFICIOS.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
              <Icono className="h-5 w-5 text-marca-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">{titulo}</p>
              <p className="mt-0.5 text-xs text-slate-400">{texto}</p>
            </li>
          ))}
        </ul>

        <p className="relative text-xs text-slate-500">
          Sprints 1 al 3 · Autenticación por roles, reservas con PIN, ciclo completo de préstamo y actualizaciones en tiempo real.
        </p>
      </aside>

      {/* Contenido (formulario) */}
      <main className="flex w-full items-center justify-center px-4 py-10 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
