/**
 * Layout de la aplicación autenticada: barra superior + contenido + pie.
 */

import { Navbar } from './Navbar.jsx';
import { config } from '../../config/env.js';

export function AppShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white/70 px-4 py-4 text-center text-xs text-slate-500">
        {config.nombreFacultad} · Sistema de préstamo de computadoras · Vencimiento y liberación
        sincronizados con el servidor
      </footer>
    </div>
  );
}
