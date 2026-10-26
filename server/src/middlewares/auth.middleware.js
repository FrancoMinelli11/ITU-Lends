/**
 * =============================================================================
 *  Middleware de autenticación
 * =============================================================================
 *  1. Extrae el token del header `Authorization: Bearer <token>`.
 *  2. Verifica firma, expiración, emisor y audiencia (ver utils/token.js).
 *  3. Revalida el usuario contra la base de datos: si fue eliminado o
 *     suspendido, el token deja de ser válido al instante (no hay que esperar
 *     a que expire). También mantiene el rol y los datos de perfil frescos.
 *
 *  Deja disponible `req.usuario` para el resto del pipeline.
 * =============================================================================
 */

import { prisma } from '../config/prisma.js';
import { ESTADO_USUARIO } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { extraerBearer, verificarToken } from '../utils/token.js';
import { serializarUsuario } from '../utils/serializers.js';

export const autenticar = asyncHandler(async (req, _res, next) => {
  const token = extraerBearer(req.headers.authorization);

  if (!token) {
    throw ApiError.noAutorizado('Falta el token de autenticación. Iniciá sesión.');
  }

  // Lanza ApiError 401 si el token es inválido o expiró.
  const payload = verificarToken(token);

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      dni: true,
      nombre: true,
      apellido: true,
      email: true,
      rol: true,
      estado: true,
      creado_en: true,
    },
  });

  if (!usuario) {
    throw ApiError.noAutorizado('La cuenta asociada a este token ya no existe.');
  }

  if (usuario.estado === ESTADO_USUARIO.SUSPENDIDO) {
    throw ApiError.prohibido('Tu cuenta está suspendida. Comunicate con secretaría.');
  }

  req.usuario = serializarUsuario(usuario);
  req.token = token;

  return next();
});
