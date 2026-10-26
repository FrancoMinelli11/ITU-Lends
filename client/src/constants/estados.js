/**
 * =============================================================================
 *  Constantes de estados del dominio (espejo del backend)
 * =============================================================================
 *  Cada estado declara su etiqueta visible y las clases Tailwind COMPLETAS de
 *  su insignia. Se escriben de forma literal (sin interpolación) porque Tailwind
 *  necesita ver las clases en el código para incluirlas en el bundle final.
 * =============================================================================
 */

export const ESTADO_COMPUTADORA = {
  DISPONIBLE: 'DISPONIBLE',
  RESERVADA: 'RESERVADA',
  EN_USO: 'EN_USO',
  MANTENIMIENTO: 'MANTENIMIENTO',
};

export const ESTADO_PRESTAMO = {
  PENDIENTE_RETIRO: 'PENDIENTE_RETIRO',
  ACTIVO: 'ACTIVO',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
};

/** Metadatos de presentación por estado de computadora. */
export const META_ESTADO_COMPUTADORA = {
  DISPONIBLE: {
    etiqueta: 'Disponible',
    descripcion: 'Lista para reservar',
    insignia: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    punto: 'bg-emerald-500',
    borde: 'border-slate-200 hover:border-emerald-300',
    barra: 'bg-emerald-500',
  },
  RESERVADA: {
    etiqueta: 'Reservada',
    descripcion: 'Reservada por otro alumno',
    insignia: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    punto: 'bg-amber-500',
    borde: 'border-amber-200',
    barra: 'bg-amber-500',
  },
  EN_USO: {
    etiqueta: 'En uso',
    descripcion: 'Ocupada en este momento',
    insignia: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    punto: 'bg-rose-500',
    borde: 'border-rose-200',
    barra: 'bg-rose-500',
  },
  MANTENIMIENTO: {
    etiqueta: 'Mantenimiento',
    descripcion: 'Fuera de servicio',
    insignia: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300',
    punto: 'bg-slate-400',
    borde: 'border-slate-200',
    barra: 'bg-slate-400',
  },
};

/** Metadatos de presentación por estado de préstamo. */
export const META_ESTADO_PRESTAMO = {
  PENDIENTE_RETIRO: {
    etiqueta: 'Pendiente de retiro',
    insignia: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    punto: 'bg-amber-500',
  },
  ACTIVO: {
    etiqueta: 'En uso',
    insignia: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200',
    punto: 'bg-indigo-500',
  },
  FINALIZADO: {
    etiqueta: 'Finalizado',
    insignia: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    punto: 'bg-emerald-500',
  },
  CANCELADO: {
    etiqueta: 'Cancelado',
    insignia: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-300',
    punto: 'bg-slate-400',
  },
  CANCELADO_NO_SHOW: {
    etiqueta: 'No presentado',
    insignia: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    punto: 'bg-orange-500',
  },
};

/** Severidades de un reporte de falla (Sprint 3 - US-08). */
export const SEVERIDAD_FALLA = {
  LEVE: 'LEVE',
  GRAVE: 'GRAVE',
  CRITICA: 'CRITICA',
};

/** Metadatos de presentación por severidad de falla (clases Tailwind literales). */
export const META_SEVERIDAD_FALLA = {
  LEVE: {
    etiqueta: 'Leve',
    descripcion: 'Detalle menor: el equipo sigue operativo',
    insignia: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    punto: 'bg-emerald-500',
    texto: 'text-emerald-700',
    borde: 'border-emerald-300',
    fondo: 'bg-emerald-50',
  },
  GRAVE: {
    etiqueta: 'Grave',
    descripcion: 'El equipo queda fuera de servicio (mantenimiento)',
    insignia: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    punto: 'bg-amber-500',
    texto: 'text-amber-700',
    borde: 'border-amber-300',
    fondo: 'bg-amber-50',
  },
  CRITICA: {
    etiqueta: 'Crítica',
    descripcion: 'Riesgo de daño: requiere revisión urgente',
    insignia: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
    punto: 'bg-rose-500',
    texto: 'text-rose-700',
    borde: 'border-rose-300',
    fondo: 'bg-rose-50',
  },
};

/** Estados que ocupan al alumno (no puede tener dos a la vez). */
export const ESTADOS_VIGENTES = [ESTADO_PRESTAMO.PENDIENTE_RETIRO, ESTADO_PRESTAMO.ACTIVO];

export const ROL = {
  ALUMNO: 'ALUMNO',
  SECRETARIO: 'SECRETARIO',
};

/** Filtros rápidos del catálogo del alumno. */
export const FILTROS_CATALOGO = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  { valor: ESTADO_COMPUTADORA.DISPONIBLE, etiqueta: 'Disponibles' },
  { valor: ESTADO_COMPUTADORA.RESERVADA, etiqueta: 'Reservadas' },
  { valor: ESTADO_COMPUTADORA.EN_USO, etiqueta: 'En uso' },
  { valor: ESTADO_COMPUTADORA.MANTENIMIENTO, etiqueta: 'Mantenimiento' },
];
