/**
 * =============================================================================
 *  Punto de entrada del backend
 * =============================================================================
 *  Arranque ordenado:
 *    1. Verificar variables de entorno (config/env.js falla rápido si falta algo).
 *    2. Conectar a PostgreSQL.
 *    3. Crear el servidor HTTP con Express.
 *    4. Inicializar Socket.io sobre el mismo servidor/puerto.
 *    5. Iniciar los jobs programados (no-show de reservas y alerta de vencimiento).
 *    6. Escuchar y registrar apagado ordenado (SIGINT/SIGTERM/SIGBREAK).
 *
 *  Ejecución:  npm run dev   (desarrollo, con --watch)
 *              npm start     (producción)
 * =============================================================================
 */

import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { conectarBD, desconectarBD, prisma } from './config/prisma.js';
import { cerrarSocket, iniciarSocket } from './realtime/socket.js';
import { detenerJobAlerta, iniciarJobAlerta } from './jobs/alertaVencimiento.job.js';
import { detenerJobExpiracion, iniciarJobExpiracion } from './jobs/expiracionReservas.job.js';

const separador = (caracter = '=') => caracter.repeat(66);

async function arrancar() {
  console.log(`\n${separador()}`);
  console.log('  🖥️  API de Préstamo de Computadoras - Sprints 1 al 3');
  console.log(separador());
  console.log(`  Entorno: ${env.nodeEnv}`);

  // 1) Base de datos ---------------------------------------------------------
  await conectarBD();

  // Aviso útil para quien clona el proyecto por primera vez.
  const computadorasCargadas = await prisma.computadora.count();
  if (computadorasCargadas === 0) {
    console.warn('  ⚠️  No hay computadoras cargadas. Ejecutá:  npm run db:seed');
  }

  // 2) Servidor HTTP + WebSockets -------------------------------------------
  const servidor = http.createServer(app);
  iniciarSocket(servidor);

  // 3) Jobs programados (no-show + alerta de vencimiento) --------------------
  iniciarJobExpiracion();
  iniciarJobAlerta();

  // 4) Escuchar --------------------------------------------------------------
  servidor.listen(env.puerto, () => {
    console.log(separador('-'));
    console.log(`  ✅ API REST:      http://localhost:${env.puerto}/api`);
    console.log(`  ✅ Health check:  http://localhost:${env.puerto}/api/health`);
    console.log(`  ✅ Socket.io:     ws://localhost:${env.puerto}`);
    console.log(`  🌐 CORS permitido para: ${env.corsOrigins.join(', ')}`);
    console.log('  ⏱️  Reglas: préstamo de ' +
      `${env.negocio.duracionPrestamoMinutos} min | anticipación máx. ${env.negocio.anticipacionMaximaMinutos} min | ` +
      `tolerancia de retiro ${env.negocio.toleranciaCheckInMinutos} min | ` +
      `alerta previa ${env.negocio.alertaVencimientoMinutos} min | extensión +${env.negocio.extensionPrestamoMinutos} min`);
    console.log(`${separador()}\n`);
  });

  // 5) Apagado ordenado ------------------------------------------------------
  let cerrando = false;

  const apagar = async (senal) => {
    if (cerrando) return;
    cerrando = true;
    console.log(`\n[server] Señal ${senal} recibida. Cerrando ordenadamente...`);

    detenerJobExpiracion();
    detenerJobAlerta();
    await cerrarSocket();

    servidor.close(async () => {
      await desconectarBD();
      console.log('[server] Adiós 👋');
      process.exit(0);
    });

    // Si algo queda colgado, forzamos la salida después de 10 s.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  // SIGBREAK es la señal de interrupción de Windows (Ctrl+Break).
  for (const senal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    process.on(senal, () => void apagar(senal));
  }

  // Errores no controlados: se registran para no morir en silencio.
  process.on('unhandledRejection', (motivo) => {
    console.error('[server] Promesa rechazada sin manejar:', motivo);
  });
  process.on('uncaughtException', (error) => {
    console.error('[server] Excepción no capturada:', error);
    void apagar('uncaughtException');
  });
}

arrancar().catch(async (error) => {
  console.error('\n❌ No se pudo iniciar el servidor:\n', error.message);
  if (env.esDesarrollo && error.stack) console.error(error.stack);
  await desconectarBD().catch(() => {});
  process.exit(1);
});
