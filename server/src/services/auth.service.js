/**
 * =============================================================================
 *  Servicio de autenticación
 * =============================================================================
 *  Reglas de negocio:
 *   - El registro público crea EXCLUSIVAMENTE alumnos (un secretario se crea
 *     por seed o por un administrador).
 *   - DNI y email son claves naturales únicas: se validan antes de escribir y
 *     se protege además con la restricción UNIQUE de la base (condición de
 *     carrera entre dos registros simultáneos).
 *   - Las contraseñas se almacenan siempre hasheadas con bcrypt.
 *   - El login no revela si el email existe (mensaje genérico de credenciales).
 * =============================================================================
 */

import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { hashearPassword, verificarPassword } from '../utils/passwords.js';
import { firmarToken } from '../utils/token.js';
import { serializarUsuario } from '../utils/serializers.js';
import { ESTADO_USUARIO, ROL } from '../config/constants.js';
import { SELECT_USUARIO_PUBLICO } from '../data/includes.js';

/**
 * Registra un alumno nuevo.
 * @param {{dni:string, nombre:string, apellido:string, email:string, password:string, confirmar_password?:string}} datos
 * @returns {Promise<{ usuario: object, token: string }>}
 */
export async function registrarAlumno(datos) {
  const { dni, nombre, apellido, email, password, confirmar_password } = datos;

  // 1) Coherencia de la confirmación (se valida en el servidor, no solo en la UI)
  if (confirmar_password !== undefined && confirmar_password !== password) {
    throw ApiError.badRequest('Las contraseñas no coinciden.', [
      { campo: 'confirmar_password', mensaje: 'La confirmación debe coincidir con la contraseña.' },
    ]);
  }

  // 2) Verificación explícita de duplicados -> mensajes claros por campo
  const duplicados = await prisma.usuario.findMany({
    where: { OR: [{ dni }, { email }] },
    select: { dni: true, email: true },
  });

  if (duplicados.length > 0) {
    const detalles = [];
    if (duplicados.some((u) => u.dni === dni)) {
      detalles.push({ campo: 'dni', mensaje: 'Ya existe una cuenta registrada con ese DNI.' });
    }
    if (duplicados.some((u) => u.email === email)) {
      detalles.push({ campo: 'email', mensaje: 'Ya existe una cuenta registrada con ese correo.' });
    }
    throw new ApiError(409, 'Ya existe una cuenta con esos datos.', {
      codigo: 'USUARIO_DUPLICADO',
      detalles,
    });
  }

  // 3) Persistencia (el hash se calcula antes de abrir la transacción porque es costoso en CPU)
  const passwordHash = await hashearPassword(password);

  const usuario = await prisma.usuario.create({
    data: {
      dni,
      nombre,
      apellido,
      email,
      password: passwordHash,
      rol: ROL.ALUMNO,
      estado: ESTADO_USUARIO.ACTIVO,
    },
    select: SELECT_USUARIO_PUBLICO,
  });

  // Se devuelve el token directamente: el alumno entra logueado tras registrarse.
  return { usuario: serializarUsuario(usuario), token: firmarToken(usuario) };
}

/**
 * Inicia sesión (alumno o secretario).
 * @param {{email:string, password:string}} credenciales
 * @returns {Promise<{ usuario: object, token: string }>}
 */
export async function iniciarSesion({ email, password }) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mensaje genérico: no se revela si el email existe o si la contraseña es incorrecta.
  const credencialesInvalidas = new ApiError(401, 'Correo electrónico o contraseña incorrectos.', {
    codigo: 'CREDENCIALES_INVALIDAS',
  });

  if (!usuario) throw credencialesInvalidas;

  const coincide = await verificarPassword(password, usuario.password);
  if (!coincide) throw credencialesInvalidas;

  if (usuario.estado === ESTADO_USUARIO.SUSPENDIDO) {
    throw ApiError.prohibido('Tu cuenta está suspendida. Comunicate con secretaría para reactivarla.');
  }

  return {
    usuario: serializarUsuario(usuario),
    token: firmarToken(usuario),
  };
}

/**
 * Devuelve el perfil del usuario autenticado (usado por el frontend al
 * recargar la aplicación para revalidar el token guardado).
 * @param {string} usuarioId
 */
export async function obtenerPerfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: SELECT_USUARIO_PUBLICO,
  });

  if (!usuario) throw ApiError.noAutorizado('La cuenta ya no existe.');

  return serializarUsuario(usuario);
}
