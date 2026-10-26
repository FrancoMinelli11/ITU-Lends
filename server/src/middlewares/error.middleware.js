/**
 * =============================================================================
 *  Manejo centralizado de errores en Express
 * =============================================================================
 *  Todo error (esperado o no) pasa por acá, garantizando:
 *   - Un contrato de respuesta uniforme: { ok:false, error:{ mensaje, codigo, detalles } }.
 *   - Códigos HTTP semánticos (400, 401, 403, 404, 409, 429, 500).
 *   - Traducción de errores técnicos (Prisma) a mensajes de negocio.
 *   - Cero fugas de stack traces o SQL en producción.
 *   - Log del lado del servidor con contexto de la request para diagnóstico.
 * =============================================================================
 */

import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/** 404 para cualquier ruta no registrada (se monta después de las rutas). */
export function manejadorRutaNoEncontrada(req, _res, next) {
  next(
    new ApiError(404, `La ruta ${req.method} ${req.originalUrl} no existe en esta API.`, {
      codigo: 'RUTA_NO_ENCONTRADA',
    }),
  );
}

/** Normaliza errores de Prisma a ApiError con status correcto. */
function desdePrisma(error) {
  switch (error.code) {
    case 'P2002': {
      // Violación de índice único: se informa el/los campos en conflicto.
      const campos = Array.isArray(error.meta?.target) ? error.meta.target : [error.meta?.target].filter(Boolean);
      const legibles = campos.map((campo) => NOMBRES_CAMPOS[campo] ?? campo).join(', ') || 'campo único';
      return new ApiError(409, `Ya existe un registro con ese valor de ${legibles}.`, {
        codigo: 'DUPLICADO',
        detalles: campos.map((campo) => ({ campo, mensaje: 'Valor ya registrado.' })),
      });
    }
    case 'P2003':
      return new ApiError(409, 'La operación viola una relación entre registros (clave foránea).', {
        codigo: 'RELACION_INVALIDA',
      });
    case 'P2011':
      return ApiError.badRequest('Falta un campo obligatorio en la base de datos.');
    case 'P2025':
      return ApiError.noEncontrado('El registro que intentás modificar ya no existe.');
    default:
      return null; // Se trata como error inesperado (500).
  }
}

/** Nombres amigables de las columnas para los mensajes de duplicado. */
const NOMBRES_CAMPOS = {
  dni: 'DNI',
  email: 'correo electrónico',
  codigo_inventario: 'código de inventario',
  token_validacion: 'PIN de validación',
};

export function manejadorErrores(error, req, res, _next) {
  let apiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    // Red de seguridad: un esquema validado dentro de un servicio.
    apiError = ApiError.badRequest(
      'Los datos enviados no son válidos.',
      error.issues.map((issue) => ({ campo: issue.path.join('.') || 'general', mensaje: issue.message })),
    );
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = desdePrisma(error) ?? ApiError.interno('Error al acceder a la base de datos.');
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    apiError = ApiError.interno('La consulta a la base de datos es inválida.');
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    apiError = new ApiError(503, 'La base de datos no está disponible en este momento.', {
      codigo: 'BD_NO_DISPONIBLE',
    });
  } else if (error instanceof SyntaxError && 'body' in error) {
    // Body JSON mal formado enviado por el cliente.
    apiError = ApiError.badRequest('El cuerpo de la solicitud no es un JSON válido.');
  } else if (error?.type === 'entity.too.large') {
    apiError = new ApiError(413, 'El cuerpo de la solicitud es demasiado grande.', { codigo: 'CUERPO_MUY_GRANDE' });
  } else {
    apiError = ApiError.interno();
  }

  // --- Log del servidor (nunca se envía al cliente) -------------------------
  const contexto = `${req.method} ${req.originalUrl} -> ${apiError.status}`;
  if (apiError.status >= 500) {
    console.error(`[error] ${contexto} | ${error?.name}: ${error?.message}`);
    if (env.esDesarrollo) console.error(error.stack);
  } else if (env.esDesarrollo) {
    console.warn(`[aviso] ${contexto} | ${apiError.message}`);
  }

  const cuerpo = {
    ok: false,
    error: {
      mensaje: apiError.message,
      codigo: apiError.codigo,
      ...(apiError.detalles ? { detalles: apiError.detalles } : {}),
    },
  };

  // En desarrollo se agrega el stack para acelerar el debugging.
  if (env.esDesarrollo && apiError.status >= 500 && error?.stack) {
    cuerpo.error.stack = error.stack.split('\n').slice(0, 6);
  }

  return res.status(apiError.status).json(cuerpo);
}
