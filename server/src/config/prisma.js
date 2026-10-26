/**
 * =============================================================================
 *  Cliente Prisma (patrón Singleton)
 * =============================================================================
 *  En desarrollo, `node --watch` reinicia el proceso y cada reinicio crea un
 *  nuevo PrismaClient: se cachea en globalThis para no agotar el pool de
 *  conexiones de PostgreSQL. En producción se instancia una única vez.
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const opciones = {
  log: env.esDesarrollo ? ['warn', 'error'] : ['error'],
};

const globalParaPrisma = globalThis;

export const prisma =
  globalParaPrisma.__prismaPrestamos ??
  new PrismaClient(opciones);

if (env.esDesarrollo) {
  globalParaPrisma.__prismaPrestamos = prisma;
}

/** Verifica la conectividad con PostgreSQL antes de aceptar tráfico. */
export async function conectarBD() {
  await prisma.$connect();
  // Consulta trivial para confirmar que el pool responde.
  await prisma.$queryRaw`SELECT 1`;
  console.log('[db] Conexión a PostgreSQL establecida correctamente.');
}

/** Cierre ordenado (graceful shutdown) liberando el pool de conexiones. */
export async function desconectarBD() {
  try {
    await prisma.$disconnect();
    console.log('[db] Conexión a PostgreSQL cerrada.');
  } catch (error) {
    // Un cierre con advertencias nunca debe frenar el apagado del servidor
    // (por ejemplo, si hay una consulta en vuelo o la BD ya no responde).
    console.warn('[db] El cierre de la conexión finalizó con advertencias:', error?.message ?? error);
  }
}

/**
 * Códigos de error conocidos de Prisma -> mensajes de negocio en español.
 * Se usan en el error handler global para no filtrar detalles internos.
 */
export const PRISMA_ERROR = {
  UNIQUE_CONSTRAINT: 'P2002',
  FK_CONSTRAINT: 'P2003',
  NOT_FOUND: 'P2025',
  NULL_CONSTRAINT: 'P2011',
};
