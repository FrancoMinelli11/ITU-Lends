/**
 * Barra de navegación superior.
 * Se adapta al rol: el alumno ve el catálogo, la secretaría ve el mostrador.
 */

import { useState } from 'react';
import { Monitor, LogOut, Menu, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { config } from '../../config/env.js';
import { iniciales } from '../../utils/format.js';
import { IndicadorConexion } from './IndicadorConexion.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

export function Navbar() {
  const { usuario, esSecretario, cerrarSesion } = useAuth();
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nombreCompleto = usuario ? `${usuario.nombre} ${usuario.apellido}` : '';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Marca ---------------------------------------------------------- */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-600 text-white shadow-sm">
            <Monitor className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">
              Préstamo de Computadoras
            </p>
            <p className="truncate text-xs text-slate-500">{config.nombreFacultad}</p>
          </div>
        </div>

        {/* Estado + usuario ----------------------------------------------- */}
        <div className="flex items-center gap-2 sm:gap-3">
          <IndicadorConexion />

          {/* Etiqueta de rol (solo escritorio) */}
          <span
            className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium md:inline-flex ${
              esSecretario
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200'
                : 'bg-marca-50 text-marca-700 ring-1 ring-inset ring-marca-200'
            }`}
          >
            {esSecretario ? <ShieldCheck className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            {esSecretario ? 'Secretaría' : 'Alumno'}
          </span>

          <div className="hidden text-right sm:block">
            <p className="max-w-[180px] truncate text-sm font-medium leading-tight text-slate-800">
              {nombreCompleto}
            </p>
            <p className="max-w-[180px] truncate text-xs text-slate-500">{usuario?.email}</p>
          </div>

          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {iniciales(nombreCompleto) || '?'}
          </span>

          {/* Salir (escritorio) */}
          <Button
            variante="fantasma"
            tamano="icono"
            className="hidden sm:inline-flex"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={() => setConfirmandoSalida(true)}
          >
            <LogOut className="h-4 w-4" />
          </Button>

          {/* Menú móvil */}
          <Button
            variante="fantasma"
            tamano="icono"
            className="sm:hidden"
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto((previo) => !previo)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Panel móvil ------------------------------------------------------ */}
      {menuAbierto && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
          <p className="text-sm font-medium text-slate-800">{nombreCompleto}</p>
          <p className="mb-3 truncate text-xs text-slate-500">{usuario?.email}</p>
          <Button
            variante="secundario"
            tamano="sm"
            Icono={LogOut}
            className="w-full"
            onClick={() => {
              setMenuAbierto(false);
              setConfirmandoSalida(true);
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      )}

      {/* Confirmación de salida ------------------------------------------- */}
      <Modal
        abierta={confirmandoSalida}
        onCerrar={() => setConfirmandoSalida(false)}
        titulo="Cerrar sesión"
        ancho="sm"
      >
        <p className="text-sm text-slate-600">
          ¿Querés salir del sistema? Vas a tener que volver a ingresar tu correo y contraseña.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variante="secundario" onClick={() => setConfirmandoSalida(false)}>
            Cancelar
          </Button>
          <Button variante="peligro" Icono={LogOut} onClick={() => cerrarSesion()}>
            Cerrar sesión
          </Button>
        </div>
      </Modal>
    </header>
  );
}
