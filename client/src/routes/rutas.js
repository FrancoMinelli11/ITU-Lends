/**
 * Catálogo de rutas de la aplicación.
 * Un único lugar define las URLs: evita strings sueltos por los componentes.
 */

export const RUTAS = Object.freeze({
  RAIZ: '/',
  LOGIN: '/login',
  REGISTRO: '/registro',
  DASHBOARD_ALUMNO: '/dashboard',
  DASHBOARD_SECRETARIO: '/admin',
});

/** Ruta inicial según el rol del usuario autenticado. */
export function rutaPorRol(rol) {
  return rol === 'SECRETARIO' ? RUTAS.DASHBOARD_SECRETARIO : RUTAS.DASHBOARD_ALUMNO;
}
