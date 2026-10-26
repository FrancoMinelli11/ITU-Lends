/**
 * =============================================================================
 *  Seed de base de datos - Sprints 1 al 3
 * =============================================================================
 *  Genera datos mínimos y COHERENTES para probar el sistema completo:
 *
 *   - 1 secretario por defecto.
 *   - 3 alumnos de prueba (uno libre, uno con reserva y uno con equipo en uso).
 *   - 10 computadoras con estados variados (DISPONIBLE / RESERVADA / EN_USO /
 *     MANTENIMIENTO).
 *   - 2 préstamos vigentes que respaldan los estados RESERVADA y EN_USO (para
 *     que el catálogo muestre contadores reales desde el primer arranque).
 *   - 1 reporte de falla de ejemplo sobre el equipo en mantenimiento.
 *
 *  Es IDEMPOTENTE y REFRESCABLE: puede ejecutarse varias veces sin duplicar
 *  información (upsert sobre dni/email/codigo_inventario) y los horarios de los
 *  préstamos de demo se recalculan en cada corrida, de modo que el estado
 *  inicial (1 reservada + 1 en uso) siempre quede utilizable. Un préstamo real
 *  (con otro PIN) nunca se modifica.
 *
 *  Ejecución:  npm run db:seed
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

/** Costo de bcrypt (mismo valor que usa la API para que los hashes sean compatibles). */
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS ?? 10);

/** Duración estándar del préstamo (misma regla que usa la API al reservar). */
const DURACION_PRESTAMO_MINUTOS = Number(process.env.DURACION_PRESTAMO_MINUTOS ?? 80);

/** PINs fijos de los préstamos de demo: identifican lo sembrado y facilitan la prueba. */
const PIN_RESERVA_DEMO = '4321';
const PIN_USO_DEMO = '8765';

/** Helper: suma minutos a una fecha. */
const sumarMinutos = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60 * 1000);

// -----------------------------------------------------------------------------
//  Usuarios
// -----------------------------------------------------------------------------

const SECRETARIO = {
  dni: '30111222',
  nombre: 'Marta',
  apellido: 'Gómez',
  email: 'secretaria@facultad.edu.ar',
  password: 'Secretario123!',
  rol: 'SECRETARIO',
};

const ALUMNOS = [
  {
    dni: '40111222',
    nombre: 'Lucía',
    apellido: 'Fernández',
    email: 'lucia.fernandez@alumnos.edu.ar',
    password: 'Alumno123!',
    rol: 'ALUMNO',
    // Se le asigna una reserva pendiente de retiro (PIN de prueba 4321).
  },
  {
    dni: '42333444',
    nombre: 'Tomás',
    apellido: 'Ríos',
    email: 'tomas.rios@alumnos.edu.ar',
    password: 'Alumno123!',
    rol: 'ALUMNO',
    // Tiene un equipo físico actualmente EN_USO (PIN de prueba 8765).
  },
  {
    dni: '44555666',
    nombre: 'Camila',
    apellido: 'Duarte',
    email: 'camila.duarte@alumnos.edu.ar',
    password: 'Alumno123!',
    rol: 'ALUMNO',
    // Alumno libre: sirve para probar el flujo completo de reserva.
  },
];

// -----------------------------------------------------------------------------
//  Inventario: 10 computadoras marca CX, todas iguales
//  (mismo modelo y mismas especificaciones; solo cambia el número del código)
// -----------------------------------------------------------------------------

/** Estado con el que arranca cada equipo: el resto queda DISPONIBLE. */
const ESTADO_POR_CODIGO = {
  'CX-08': 'RESERVADA',
  'CX-09': 'EN_USO',
  'CX-10': 'MANTENIMIENTO',
};

/** Códigos con rol fijo en la demo (reserva, préstamo activo y equipo roto). */
const CODIGO_RESERVADA = 'CX-08';
const CODIGO_EN_USO = 'CX-09';
const CODIGO_MANTENIMIENTO = 'CX-10';

const COMPUTADORAS = Array.from({ length: 10 }, (_, indice) => {
  // Código de inventario: prefijo de marca + número correlativo (CX-01 ... CX-10).
  const codigo_inventario = `CX-${String(indice + 1).padStart(2, '0')}`;
  return {
    codigo_inventario,
    modelo: 'CX',
    especificaciones: 'PC de escritorio CX (configuración estándar del laboratorio)',
    estado: ESTADO_POR_CODIGO[codigo_inventario] ?? 'DISPONIBLE',
  };
});

// -----------------------------------------------------------------------------
//  Utilidades
// -----------------------------------------------------------------------------

/**
 * Crea (o actualiza) un usuario hasheando su contraseña.
 * @param {{dni:string, nombre:string, apellido:string, email:string, password:string, rol:'ALUMNO'|'SECRETARIO'}} datos
 */
async function upsertUsuario(datos) {
  const passwordHash = await bcrypt.hash(datos.password, SALT_ROUNDS);

  return prisma.usuario.upsert({
    where: { email: datos.email },
    update: {
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      password: passwordHash,
      rol: datos.rol,
      estado: 'ACTIVO',
    },
    create: {
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email,
      password: passwordHash,
      rol: datos.rol,
      estado: 'ACTIVO',
    },
  });
}

const linea = (caracter = '─') => caracter.repeat(72);

// -----------------------------------------------------------------------------
//  Programa principal
// -----------------------------------------------------------------------------

async function main() {
  console.log('\n🌱 Sembrando base de datos del sistema de préstamos...\n');

  // 1) Usuarios ---------------------------------------------------------------
  const secretario = await upsertUsuario(SECRETARIO);
  const alumnos = [];
  for (const alumno of ALUMNOS) {
    alumnos.push(await upsertUsuario(alumno));
  }
  const [alumnaReserva, alumnoEnUso, alumnaLibre] = alumnos;

  // 2) Inventario de computadoras --------------------------------------------
  const computadoras = [];
  for (const pc of COMPUTADORAS) {
    computadoras.push(
      await prisma.computadora.upsert({
        where: { codigo_inventario: pc.codigo_inventario },
        update: { modelo: pc.modelo, especificaciones: pc.especificaciones },
        // En el create respetamos el estado declarado para tener variedad.
        create: pc,
      }),
    );
  }

  // Los roles de la demo se identifican por CÓDIGO, no por el estado actual:
  // así el seed vuelve a dejar el estado inicial aunque la reserva de CX-08 haya
  // expirado o el préstamo de CX-09 se haya finalizado.
  const pcReservada = computadoras.find((pc) => pc.codigo_inventario === CODIGO_RESERVADA);
  const pcEnUso = computadoras.find((pc) => pc.codigo_inventario === CODIGO_EN_USO);
  const pcMantenimiento = computadoras.find((pc) => pc.codigo_inventario === CODIGO_MANTENIMIENTO);

  // 3) Préstamos vigentes coherentes con los estados anteriores ---------------
  //    Los tiempos son RELATIVOS al momento del seed: si la reserva de demo ya
  //    venció (o el préstamo activo quedó viejo), volver a sembrar los refresca.
  //    Un préstamo real (otro PIN) nunca se toca.
  const ahora = new Date();

  // 3.a) Reserva pendiente de retiro (PIN de prueba: 4321).
  if (pcReservada) {
    const reservaExistente = await prisma.prestamo.findFirst({
      where: { computadora_id: pcReservada.id, estado: 'PENDIENTE_RETIRO' },
    });

    const horariosReserva = {
      fecha_hora_inicio: sumarMinutos(ahora, 15), // retiro programado en 15 min
      fecha_hora_fin_estimada: sumarMinutos(ahora, 15 + DURACION_PRESTAMO_MINUTOS),
    };

    if (!reservaExistente) {
      await prisma.prestamo.create({
        data: {
          usuario_id: alumnaReserva.id,
          computadora_id: pcReservada.id,
          token_validacion: PIN_RESERVA_DEMO,
          estado: 'PENDIENTE_RETIRO',
          ...horariosReserva,
        },
      });
    } else if (reservaExistente.token_validacion === PIN_RESERVA_DEMO) {
      await prisma.prestamo.update({ where: { id: reservaExistente.id }, data: horariosReserva });
    }

    // La computadora queda marcada como RESERVADA (sin pisar un mantenimiento).
    await prisma.computadora.updateMany({
      where: { id: pcReservada.id, estado: { in: ['DISPONIBLE', 'RESERVADA'] } },
      data: { estado: 'RESERVADA' },
    });
  }

  // 3.b) Préstamo activo (equipo físicamente en uso, PIN de prueba: 8765).
  if (pcEnUso) {
    const prestamoActivo = await prisma.prestamo.findFirst({
      where: { computadora_id: pcEnUso.id, estado: 'ACTIVO' },
    });

    const horariosActivo = {
      fecha_hora_inicio: sumarMinutos(ahora, -25), // empezó hace 25 min
      fecha_hora_fin_estimada: sumarMinutos(ahora, -25 + DURACION_PRESTAMO_MINUTOS), // vence al completar la duración estándar
    };

    if (!prestamoActivo) {
      await prisma.prestamo.create({
        data: {
          usuario_id: alumnoEnUso.id,
          computadora_id: pcEnUso.id,
          token_validacion: PIN_USO_DEMO,
          estado: 'ACTIVO',
          ...horariosActivo,
        },
      });
    } else if (prestamoActivo.token_validacion === PIN_USO_DEMO) {
      await prisma.prestamo.update({ where: { id: prestamoActivo.id }, data: horariosActivo });
    }

    await prisma.computadora.updateMany({
      where: { id: pcEnUso.id, estado: { in: ['DISPONIBLE', 'EN_USO'] } },
      data: { estado: 'EN_USO' },
    });
  }

  // 4) Reporte de falla de ejemplo sobre el equipo en mantenimiento ----------
  if (pcMantenimiento) {
    const descripcionDemo = 'La máquina se apaga sola a los pocos minutos de uso. Se dejó en mantenimiento.';
    const reporteExistente = await prisma.reporteFalla.findFirst({
      where: { computadora_id: pcMantenimiento.id, descripcion: descripcionDemo },
    });

    if (!reporteExistente) {
      await prisma.reporteFalla.create({
        data: {
          usuario_id: alumnoEnUso.id,
          computadora_id: pcMantenimiento.id,
          descripcion: descripcionDemo,
          severidad: 'CRITICA',
          estado: 'EN_REVISION',
          resuelto: false,
        },
      });
    } else if (!reporteExistente.resuelto && reporteExistente.severidad !== 'CRITICA') {
      // Refresca el reporte de demo (por si la migración del Sprint 3 le puso
      // el valor por defecto): un equipo en MANTENIMIENTO lleva una falla grave.
      await prisma.reporteFalla.update({
        where: { id: reporteExistente.id },
        data: { severidad: 'CRITICA', estado: 'EN_REVISION' },
      });
    }
  }

  // 5) Resumen por consola ---------------------------------------------------
  const resumenEstados = await prisma.computadora.groupBy({
    by: ['estado'],
    _count: { _all: true },
  });

  // Relectura: si un alumno real reservó la PC de demo, el seed la respetó y el
  // PIN de prueba no aplica (se informa en vez de mentir con el PIN fijo).
  const reservaVigente = pcReservada
    ? await prisma.prestamo.findFirst({
        where: { computadora_id: pcReservada.id, estado: 'PENDIENTE_RETIRO' },
        select: { token_validacion: true },
      })
    : null;
  const usoVigente = pcEnUso
    ? await prisma.prestamo.findFirst({
        where: { computadora_id: pcEnUso.id, estado: 'ACTIVO' },
        select: { token_validacion: true },
      })
    : null;

  console.log(linea('='));
  console.log('✅ Seed completado');
  console.log(linea('='));
  console.log('\n👤 Usuarios de prueba (contraseñas en texto plano solo para desarrollo):');
  console.log(`   • SECRETARIO  ${secretario.email.padEnd(34)} / ${SECRETARIO.password}`);
  ALUMNOS.forEach((a) => console.log(`   • ALUMNO      ${a.email.padEnd(34)} / ${a.password}`));
  console.log('\n💻 Computadoras:');
  console.log(`   ${computadoras.length} equipos cargados -> ${resumenEstados.map((e) => `${e.estado}: ${e._count._all}`).join(' | ')}`);
  console.log('\n🔑 Préstamos vigentes (para probar el check-in con PIN):');
  console.log(
    reservaVigente?.token_validacion === PIN_RESERVA_DEMO
      ? `   • ${pcReservada.codigo_inventario} RESERVADA -> PIN ${PIN_RESERVA_DEMO} (alumno: ${alumnaReserva.email})`
      : `   • ${pcReservada?.codigo_inventario ?? CODIGO_RESERVADA} tiene la reserva de otro alumno: el seed no la modificó`,
  );
  console.log(
    usoVigente?.token_validacion === PIN_USO_DEMO
      ? `   • ${pcEnUso.codigo_inventario} EN USO    -> PIN ${PIN_USO_DEMO} (alumno: ${alumnoEnUso.email})`
      : `   • ${pcEnUso?.codigo_inventario ?? CODIGO_EN_USO} no tiene un préstamo activo de demo`,
  );
  console.log('   (los horarios son relativos: volvé a ejecutar el seed para refrescarlos)');
  console.log(`   • Alumno libre para probar el flujo completo: ${alumnaLibre.email}`);
  console.log(`\n${linea('=')}\n`);
}

main()
  .catch((error) => {
    console.error('\n❌ Error ejecutando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
