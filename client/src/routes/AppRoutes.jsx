/**
 * Tabla de ruteo de la SPA.
 * Las rutas privadas se agrupan bajo ProtectedRoute según el rol permitido.
 */

import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { RedireccionInicial } from './RedireccionInicial.jsx';
import { RUTAS } from './rutas.js';
import { ROL } from '../constants/estados.js';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegistroPage } from '../pages/RegistroPage.jsx';
import { DashboardAlumnoPage } from '../pages/DashboardAlumnoPage.jsx';
import { DashboardSecretarioPage } from '../pages/DashboardSecretarioPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path={RUTAS.RAIZ} element={<RedireccionInicial />} />
      <Route path={RUTAS.LOGIN} element={<LoginPage />} />
      <Route path={RUTAS.REGISTRO} element={<RegistroPage />} />

      {/* Alumnos */}
      <Route element={<ProtectedRoute roles={[ROL.ALUMNO]} />}>
        <Route path={RUTAS.DASHBOARD_ALUMNO} element={<DashboardAlumnoPage />} />
      </Route>

      {/* Secretaría */}
      <Route element={<ProtectedRoute roles={[ROL.SECRETARIO]} />}>
        <Route path={RUTAS.DASHBOARD_SECRETARIO} element={<DashboardSecretarioPage />} />
      </Route>

      {/* Cualquier otra ruta */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
