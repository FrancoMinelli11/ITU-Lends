# 🖥️ Sistema de Préstamo de Computadoras — Sprints 1 al 3

Monorepo con backend (API REST + WebSockets) y frontend (SPA) para gestionar el
préstamo de computadoras de una facultad: los **alumnos** reservan equipos y los
retiran con un **PIN de 4 dígitos**; la **secretaría** valida ese PIN, entrega
el equipo y controla el inventario en tiempo real.

| Sprint | Alcance implementado |
| ------ | -------------------- |
| **1** | Modelo de datos (Prisma/PostgreSQL), autenticación con JWT + bcrypt, control de acceso por roles, registro de alumnos con validación de DNI/email duplicados, seed con secretario + 10 computadoras, login/registro en React con rutas protegidas. |
| **2** | Catálogo con estados y tiempo restante, reserva inmediata o programada (hasta 60 min) con transacciones ACID y PIN, check-in presencial por PIN, panel de secretaría, eventos en tiempo real con Socket.io y contadores regresivos sincronizados con la hora del servidor. |
| **3** | Ciclo completo del préstamo: **no-show** (reserva no retirada → `CANCELADO_NO_SHOW`), **alerta preventiva** a los 15 min por socket, **extensión +60 min** con detección de reservas posteriores, **devolución con feedback** y reporte de fallas (`LEVE/GRAVE/CRITICA` → `MANTENIMIENTO`), **historial/trazabilidad por equipo** para secretaría y **mantenimiento manual** (sacar/reintegrar con cierre de reportes). |

---

## 🧱 Stack

**Backend:** Node.js (ESM) · Express 4 · Prisma 6 · PostgreSQL · JWT · bcryptjs · Zod · Socket.io 4
**Frontend:** React 18 (Vite 5) · Tailwind CSS 3 · React Router 6 · Axios · Socket.io-client · Lucide React

---

## 📁 Estructura del proyecto

```
proyectoITU-1/
├── server/
│   ├── prisma/
│   │   ├── schema.prisma          # Modelos, enums, índices y relaciones
│   │   └── seed.js                # Datos de prueba idempotentes
│   ├── scripts/
│   │   ├── prueba-humo.mjs        # Smoke test sin base de datos
│   │   └── prueba-e2e.mjs         # Prueba de integración (HTTP + Socket.io + PG)
│   └── src/
│       ├── index.js               # Arranque: DB -> HTTP -> Sockets -> Job
│       ├── app.js                 # Pipeline Express (seguridad, rutas, errores)
│       ├── config/                # env (única lectura de process.env), Prisma, constantes
│       ├── data/                  # Fragmentos de consulta compartidos (include/select)
│       ├── routes/                # Definición de endpoints + middlewares
│       ├── controllers/           # Adaptación HTTP <-> servicio
│       ├── services/              # Reglas de negocio + acceso a datos (Prisma)
│       ├── middlewares/           # auth, role, validate (Zod), errores, rate limit
│       ├── validators/            # Esquemas Zod de entrada
│       ├── utils/                 # ApiError, JWT, bcrypt, PIN, fechas, serializers
│       ├── realtime/              # Socket.io: conexión y emisores de eventos
│       └── jobs/                  # Expiración de reservas (no-show) + alerta de vencimiento
└── client/
    └── src/
        ├── api/                   # axiosClient + módulos por recurso
        ├── context/               # AuthContext (sesión) y SocketContext (tiempo real)
        ├── hooks/                 # useComputadoras, useMisPrestamos, useCountdown, ...
        ├── components/            # ui/, layout/, auth/, computadoras/, prestamos/
        ├── pages/                 # Login, Registro, Dashboard alumno, Panel secretaría
        ├── routes/                # Protección de rutas por rol
        ├── constants/             # Estados, eventos de socket y reglas de negocio
        └── utils/                 # Reloj sincronizado, formato de fechas
```

**Flujo de capas del backend:** `routes → (middlewares) → controllers → services → Prisma`.
**Flujo de capas del frontend:** `pages → components` con `hooks/context` como única
puerta de entrada a la red. Ningún componente de UI llama a Axios directamente.

---

## ✅ Requisitos previos

- **Node.js ≥ 18.18** (probado con Node 20/22/24)
- **PostgreSQL ≥ 13** en ejecución local (o una URL de conexión remota)

---

## 🚀 Puesta en marcha

### 1. Base de datos

Crear la base (ejemplo con `psql`):

```bash
psql -U postgres -c "CREATE DATABASE prestamos_itu;"
```

### 2. Backend

```bash
cd server
cp .env.example .env          # En Windows PowerShell: Copy-Item .env.example .env
npm install
npx prisma migrate dev --name init    # Crea las tablas
npm run db:seed                       # Secretario + alumnos + 10 computadoras
npm run dev                           # http://localhost:4000
```

Variables clave de `server/.env` (todas comentadas en `.env.example`):

| Variable | Descripción |
| -------- | ----------- |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL. |
| `JWT_SECRET` | Secreto de firma. Generar con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |
| `JWT_EXPIRES_IN` | Vida del token (`8h` por defecto). |
| `CORS_ORIGIN` | Origen(es) del frontend separados por coma. |
| `DURACION_PRESTAMO_MINUTOS` | Duración estándar del préstamo (80). |
| `ANTICIPACION_MAXIMA_MINUTOS` | Anticipación máxima para reservar (60). |
| `TOLERANCIA_CHECK_IN_MINUTOS` | Tolerancia para retirar antes de que expire la reserva (15). |
| `ALERTA_VENCIMIENTO_MINUTOS` | Aviso preventivo al alumno cuando un préstamo activo tiene ≤ esos minutos de uso (15). |
| `EXTENSION_PRESTAMO_MINUTOS` | Minutos que suma cada extensión solicitada (60). |
| `VENTANA_EXTENSION_RESERVA_MINUTOS` | Ventana futura de reservas que bloquea una extensión (60). |
| `INTERVALO_EXPIRACION_SEGUNDOS` | Cada cuánto corre el job de expiración/no-show (30). |
| `INTERVALO_ALERTA_SEGUNDOS` | Cada cuánto corre el job de alerta de vencimiento (30). |

### 3. Frontend

```bash
cd client
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### 4. Migración desde una versión anterior (Sprint 2 → 3)

La base existente **no se rompe ni se pierde información**: la migración del Sprint 3
(`20261026133220_sprint3_ciclo_completo`) solo agrega:

- el enum `SeveridadFalla` (`LEVE`/`GRAVE`/`CRITICA`) y la columna `severidad`
  (con valor por defecto `LEVE`) + `resuelto` (`false` por defecto) en `ReporteFalla`;
- el valor de enum `CANCELADO_NO_SHOW` en `EstadoPrestamo` (se agrega sin tocar filas);
- `Prestamo.observaciones_devolucion` (`NULL` por defecto) y
  `Prestamo.alerta_vencimiento_enviada` (`false` por defecto).

```bash
cd server
npm run db:migrate      # = npx prisma migrate dev: aplica la migración pendiente
npx prisma generate     # regenera el cliente (si el servidor está con node --watch, detenerlo antes)
npm run db:seed         # opcional: refresca el reporte de demostración con severidad CRITICA
npm run dev
```

> **Windows:** si `prisma generate` falla con `EPERM`, cerrá el proceso de `npm run dev`
> (que mantiene `node_modules` abierto), regenerá y volvé a levantar.

### 5. Desde la raíz (opcional)

```bash
npm run instalar     # Instala server + client + root
npm run db:migrate   # prisma migrate dev
npm run db:seed      # Datos de prueba
npm run test:humo    # Verificaciones del backend (no necesita base de datos)
npm run test:e2e     # Prueba de integración completa (necesita base + servidor arriba)
npm run dev          # Levanta backend y frontend en paralelo
```

### 6. Verificación sin base de datos (*smoke test*)

`npm run test:humo --prefix server` recorre el backend de punta a punta sin tocar
PostgreSQL: importa todos los módulos, levanta el pipeline HTTP en un puerto efímero,
comprueba el contrato de respuestas (`200/400/401/404`), el handshake de Socket.io, los
esquemas Zod (incluidos los del Sprint 3: devolución con reporte y cambio de estado
manual), la firma y verificación de JWT, el hasheo bcrypt, los serializadores (incluida la
no exposición del PIN y del hash, y el DTO de `ReporteFalla`), la segmentación por salas,
los estados/constantes del dominio (`CANCELADO_NO_SHOW`, severidades), la configuración
de alerta/extensión y la tolerancia a fallos de BD de **ambos jobs** (expiración y alerta
de vencimiento). Es útil como paso previo en CI o antes de una demo.
Termina con código de salida `1` si alguna verificación falla. **80 verificaciones.**

### 7. Prueba de integración E2E (con base de datos)

Con PostgreSQL migrado, el seed cargado y el servidor levantado:

```bash
npm run test:e2e --prefix server     # también: npm run test:e2e desde la raíz
```

Recorre el ciclo real por HTTP y Socket.io en **10 secciones**: registro/login, catálogo
CX, **carrera entre dos alumnos por la misma computadora**, privacidad del PIN en los
eventos, check-in de secretaría, finalización y expiración automática (**no-show** →
`CANCELADO_NO_SHOW`), y las secciones nuevas del Sprint 3:

- **[8/10]** extensión +60 min (happy path con eventos en vivo, `403` de no titular,
  `409` por préstamo no activo, `409` por reserva posterior) y **alerta de 15 min**
  emitida **exactamente una vez** por el job real (backdateo directo en la BD).
- **[9/10]** devolución con reporte `GRAVE` → PC a `MANTENIMIENTO`, validaciones `400`,
  permisos `403`/`409`, **historial por equipo** de secretaría y transiciones manuales
  de mantenimiento (incluido el cierre automático de reportes al reintegrar).

Es idempotente (crea usuarios `e2e.*` con DNI único por corrida) y libera todo lo que
genera, dejando el inventario como estaba. Tarda ~2 minutos (espera los jobs reales).
Si el servidor se reinicia a mitad de la corrida, volvé a ejecutarla.

---

## 🔑 Credenciales del seed

| Rol | Email | Contraseña |
| --- | ----- | ---------- |
| **Secretario** | `secretaria@facultad.edu.ar` | `Secretario123!` |
| Alumno con reserva pendiente (PIN `4321`) | `lucia.fernandez@alumnos.edu.ar` | `Alumno123!` |
| Alumno con equipo en uso (PIN `8765`) | `tomas.rios@alumnos.edu.ar` | `Alumno123!` |
| Alumno libre (para probar el flujo completo) | `camila.duarte@alumnos.edu.ar` | `Alumno123!` |

Inventario sembrado: **10 computadoras marca CX idénticas (mismo modelo y
especificaciones; solo cambia el número: `CX-01` … `CX-10`)** → 7 disponibles, 1 reservada
(`CX-08`), 1 en uso (`CX-09`) y 1 en mantenimiento (`CX-10`).

Las dos reservas de demo se crean relativas al momento del seed, así que con el correr de
los minutos la de `CX-08` caduca sola (job de tolerancia) y el préstamo de `CX-09` queda
esperando la devolución en el panel de secretaría. Para volver a ese estado:
`npm run db:seed`.

---

## 🧪 Guion de prueba sugerido (Sprint 2)

1. **Alumno** (`camila.duarte`): entrar a `/dashboard`, elegir una PC disponible y
   reservar "Ahora mismo" → se muestra el **PIN de 4 dígitos**.
2. **Secretaría** (`secretaria`): en `/admin` ingresar el PIN → el préstamo pasa a
   **EN_USO** y la PC a **En uso** en un clic.
3. Volver a la pestaña del alumno: **sin recargar**, el catálogo ya muestra la PC en
   rojo y su tarjeta "Mi préstamo actual" pasó a modo activo con el contador de uso.
4. **Secretaría**: en la cola, botón **Recibir equipo** → confirma la recepción y la PC
   vuelve a *Disponible*; el alumno lo ve al instante.
5. **Prueba de la tolerancia**: reservar una PC y no retirarla; al vencer la tolerancia
   (`TOLERANCIA_CHECK_IN_MINUTOS`) el job la libera solo y el catálogo se actualiza.
6. **Prueba de concurrencia**: abrir dos navegadores con dos alumnos distintos y hacer
   clic en "Confirmar reserva" sobre la misma PC a la vez → solo uno obtiene el PIN, el
   otro recibe `409` con el mensaje "acaba de ser tomada por otro usuario".

---

## 🧪 Guion de prueba sugerido (Sprint 3)

1. **Flujo completo de uso**: `camila.duarte` reserva una PC → secretaría hace check-in →
   con el préstamo **ACTIVO**, aparece en la tarjeta del alumno el botón
   **Extender +60 min** y **Devolver equipo**, además del banner flotante cuando falten
   15 minutos (para verlo sin esperar: acortá `DURACION_PRESTAMO_MINUTOS` a `5`,
   `ALERTA_VENCIMIENTO_MINUTOS` a `2` e `INTERVALO_ALERTA_SEGUNDOS` a `10` en
   `server/.env`, reiniciá el backend y reservá de nuevo). Note que la alerta se emite
   una sola vez por vencimiento, aunque el job corra cada tanto.
2. **Extensión bloqueada**: mientras el préstamo está activo, programá una reserva de
   otra persona sobre la misma PC dentro de la hora siguiente (otra pestaña/incógnito,
   o con la API) → al intentar extender, el alumno recibe **409** con el aviso
   "Devolvé el equipo a tiempo para respetar el turno siguiente".
3. **Devolución con falla**: `camila.duarte` → *Devolver equipo* → activa
   "¿Tuviste problemas con el equipo?", elige **Grave** y describe la falla → al
   confirmar, la PC pasa a **MANTENIMIENTO**, el préstamo queda `FINALIZADO` con sus
   observaciones y la secretaría ve el cambio en vivo.
4. **Recepción por mostrador**: la secretaría, en la cola, abre **Recibir equipo** →
   el modal muestra los comentarios/daños que el alumno haya dejado; puede agregar sus
   propias observaciones y confirmar (o registrar otro reporte).
5. **Historial y trazabilidad**: en *Inventario*, botón **Historial** de una PC → se ven
   los últimos préstamos con quién los usó (nombre + DNI), observaciones de devolución y
   todas las fallas con severidad y estado (pendiente/resuelta).
6. **Mantenimiento manual**: mismo panel → **Sacar de servicio** (pide confirmación) y
   **Reintegrar**. Al reintegrar, los reportes abiertos de esa PC quedan *Resueltos*.
7. **No-show**: reservar una PC sin retirarla; al pasar la tolerancia
   (`TOLERANCIA_CHECK_IN_MINUTOS`), el job la libera, la PC vuelve a *Disponible* y el
   préstamo aparece en el historial del alumno como **No presentado** (`CANCELADO_NO_SHOW`),
   no como cancelación manual.

---

## 🔌 API REST

Todas las respuestas exitosas usan el envoltorio `{ ok: true, data, meta }`, donde
`meta.servidor_timestamp` es la hora del servidor (usada para los contadores).
Los errores usan `{ ok: false, error: { mensaje, codigo, detalles? } }`.

| Método | Endpoint | Rol | Descripción |
| ------ | -------- | --- | ----------- |
| `GET` | `/api/health` | público | Health check. |
| `POST` | `/api/auth/registro` | público | Alta de alumno (DNI/email duplicados → 409). |
| `POST` | `/api/auth/login` | público | Login de alumno o secretario → `{ usuario, token }`. |
| `GET` | `/api/auth/me` | autenticado | Perfil del token actual. |
| `GET` | `/api/servidor/hora` | autenticado | Reloj autoritativo. |
| `GET` | `/api/computadoras` | autenticado | Catálogo con `liberacion_en` y `tiempo_restante_segundos`. |
| `GET` | `/api/computadoras/:id` | autenticado | Detalle de un equipo. |
| `GET` | `/api/computadoras/estadisticas/resumen` | secretario | Contadores por estado. |
| `POST` | `/api/prestamos/reservar` | alumno | Reserva inmediata o programada + PIN. |
| `GET` | `/api/prestamos/mios` | alumno | Préstamo vigente + historial. |
| `POST` | `/api/prestamos/check-in` | secretario | Valida PIN y pasa la PC a `EN_USO`. |
| `GET` | `/api/prestamos/vigentes` | secretario | Reservas pendientes + préstamos activos. |
| `POST` | `/api/prestamos/:id/extender` | alumno (titular) | Suma `EXTENSION_PRESTAMO_MINUTOS` al fin estimado; `409` si hay otra reserva en la hora siguiente o el préstamo no está `ACTIVO`. |
| `POST` | `/api/prestamos/:id/devolver` | alumno (el propio) / secretario | Cierra el préstamo (`FINALIZADO` + hora real), guarda observaciones y crea un `ReporteFalla` opcional. Falla `GRAVE`/`CRITICA` → PC a `MANTENIMIENTO`. |
| `POST` | `/api/prestamos/:id/finalizar` | secretario | Recepción sin reporte (delega en `devolver`). |
| `POST` | `/api/prestamos/:id/cancelar` | alumno (la propia) / secretario | Cancela una reserva pendiente. |
| `GET` | `/api/computadoras/:id/historial` | secretario | Trazabilidad: últimos préstamos con alumno y observaciones + reportes de falla. |
| `PATCH` | `/api/computadoras/:id/estado` | secretario | Mantenimiento manual: `DISPONIBLE → MANTENIMIENTO` (`409` si está ocupada) o `MANTENIMIENTO → DISPONIBLE` (cierra sus reportes abiertos). |

Códigos de estado utilizados: `200`, `201`, `400`, `401`, `403`, `404`, `409`, `413`,
`429` y `500`.

---

## 📡 Eventos de Socket.io

| Evento | Destinatarios | Payload |
| ------ | ------------- | ------- |
| `conectado` | cliente que se conecta | `{ mensaje, servidor_timestamp }` |
| `computadora_actualizada` | todos (difusión) | `{ computadora, motivo, servidor_timestamp }` |
| `nuevo_prestamo` | `secretaria` + dueño | `{ prestamo, servidor_timestamp }` |
| `prestamo_actualizado` | `secretaria` + dueño | `{ prestamo, motivo, servidor_timestamp }` |
| `reserva_expirada` | `secretaria` + dueño | `{ prestamo, computadora, servidor_timestamp }` |
| `prestamo_por_vencer` | `secretaria` + dueño | `{ prestamo (sin PIN), servidor_timestamp }` |
| `sincronizar_hora` | cliente → servidor (ack) | `{ servidor_timestamp }` |

Motivos de `computadora_actualizada`: `nueva_reserva`, `check_in`, `devolucion`,
`devolucion_con_falla`, `extension`, `mantenimiento_manual[:detalle]`,
`reintegro_mantenimiento`, `cambio_de_estado` y los motivos de cancelación
(`CANCELADO_POR_ALUMNO`, `CANCELADO_POR_SECRETARIA`, `EXPIRADO_POR_FALTA_DE_RETIRO`).

Motivos de `prestamo_actualizado`: `check_in_por_<id>`, `devolucion_por_secretaria`,
`devolucion_por_alumno`, `extension`, `actualizacion` y los mismos motivos de
cancelación (el no-show se emite con `EXPIRADO_POR_FALTA_DE_RETIRO` sobre un
préstamo cuyo estado es `CANCELADO_NO_SHOW`).

La conexión se autentica con `io(url, { auth: { token } })`. Si el token es inválido la
conexión se rechaza; sin token se permite una conexión anónima de solo lectura.

**Privacidad del PIN.** Al conectar, cada cliente entra a su sala privada `usuario:<id>` y
los secretarios también a la sala `secretaria`. Los eventos que transportan un préstamo
incluyen el PIN de retiro, por lo que se emiten **solo** a esas salas: un alumno nunca
recibe el PIN de una reserva ajena. Únicamente `computadora_actualizada` (que no lleva
datos sensibles) se difunde a todos para que el catálogo se sincronice en vivo. La alerta
`prestamo_por_vencer` se serializa con `mostrarPin: false`: avisa sin exponer credenciales.

**Jobs programados.** `server/src/jobs/` corre dos intervalos con `unref()` y guardas de
solapamiento, ambos iniciados desde `src/index.js`:

| Job | Intervalo | Qué hace |
| --- | --------- | -------- |
| `expiracionReservas.job.js` | `INTERVALO_EXPIRACION_SEGUNDOS` | Reservas `PENDIENTE_RETIRO` sin check-in más allá de `TOLERANCIA_CHECK_IN_MINUTOS` → `CANCELADO_NO_SHOW`, PC de vuelta a `DISPONIBLE`, evento `reserva_expirada` + `computadora_actualizada`. |
| `alertaVencimiento.job.js` | `INTERVALO_ALERTA_SEGUNDOS` | Préstamos `ACTIVO` con ≤ `ALERTA_VENCIMIENTO_MINUTOS` restantes y sin avisar → emite `prestamo_por_vencer` a secretaría y al dueño. La marca `alerta_vencimiento_enviada` se actualiza con un `updateMany` condicionado (CAS) dentro de una transacción, garantizando **un único aviso** aunque varios jobs se solapen. La extensión reactiva la marca para que el nuevo vencimiento vuelva a avisar. |

---

## 🧠 Decisiones técnicas relevantes

### Prevención de *race conditions* en la reserva

Leer el estado de la PC y luego escribir `RESERVADA` no es seguro: dos requests
simultáneos podrían leer `DISPONIBLE` y ambos crear un préstamo. La solución aplicada es
una **transición atómica (compare-and-swap)** dentro de `prisma.$transaction`:

```js
const bloqueo = await tx.computadora.updateMany({
  where: { id: computadoraId, estado: 'DISPONIBLE' },   // <- condición en el WHERE
  data:  { estado: 'RESERVADA' },
});
if (bloqueo.count === 0) throw ApiError.conflicto('La computadora acaba de ser tomada...');
```

PostgreSQL ejecuta un único `UPDATE ... WHERE id = $1 AND estado = 'DISPONIBLE'`. Bajo
READ COMMITTED, si dos transacciones tocan la misma fila la segunda espera el bloqueo y,
al liberarse, **reevalúa el WHERE** contra la fila ya actualizada: devuelve `count = 0` y
la transacción se aborta completa (rollback), sin dejar datos inconsistentes. Además, el
PIN se genera verificando su unicidad entre los préstamos vigentes dentro de la misma
transacción, y el job de expiración también usa `updateMany` con guardas de estado (por
eso es idempotente).

> **Endurecimiento opcional en la base de datos** (segunda barrera, además de la lógica):
> ```sql
> CREATE UNIQUE INDEX un_prestamo_vigente_por_alumno
>   ON prestamos (usuario_id)
>   WHERE estado IN ('PENDIENTE_RETIRO', 'ACTIVO');
> ```

### Reloj sincronizado

El backend incluye `servidor_timestamp` en cada respuesta HTTP y en cada evento de socket;
el cliente calcula el offset (con corrección por RTT en el handshake de socket) en
`client/src/utils/reloj.js`. Todos los contadores regresivos usan `ahora()` de ese módulo
en lugar de `Date.now()`, así que dos dispositivos con relojes distintos muestran el mismo
tiempo restante.

### Manejo de errores

Un único `manejadorErrores` en `server/src/middlewares/error.middleware.js` traduce errores
de Zod y de Prisma (P2002 duplicado, P2003 relación, P2025 inexistente) a respuestas
semánticas, registra el detalle en el servidor y **nunca filtra stack traces ni SQL** en
producción.

### Notas

- Se usa **`bcryptjs`** (implementación pura del algoritmo bcrypt, misma API y hashes
  compatibles con `bcrypt`) para evitar fallos de compilación nativa en Windows/CI.
- Prisma muestra un aviso de deprecación por la clave `prisma.seed` de `package.json`
  (migrará a `prisma.config.ts` en la v7); en Prisma 6 funciona con normalidad.
- La sesión se guarda en `localStorage` (según lo pedido en el Sprint 1). Para producción
  se recomienda migrar a cookies `httpOnly` + refresh tokens y agregar rotación.
- El frontend usa URLs absolutas (`VITE_API_URL`) con CORS habilitado en el backend, de
  modo que el mismo build sirve para local, Docker o un servidor remoto.

---

## 🛠️ Problemas frecuentes

| Síntoma | Causa / solución |
| ------- | ---------------- |
| `No se pudo conectar con el servidor` en el login | El backend no está corriendo o `VITE_API_URL` no coincide con el puerto real. |
| Error de CORS en la consola del navegador | Agregar el origen del frontend a `CORS_ORIGIN` en `server/.env` y reiniciar. |
| `Can't reach database server` al migrar | PostgreSQL apagado, credenciales o nombre de base incorrectos en `DATABASE_URL`. |
| El catálogo aparece vacío | Falta ejecutar `npm run db:seed`. |
| La conexión de socket queda en "Reconectando" | El token expiró (cerrar y volver a iniciar sesión) o el puerto del backend no está accesible. |
| `prisma migrate dev` no encuentra el seed | Ejecutarlo a mano: `npm run db:seed`. |

---

## 🔭 Próximos pasos (fuera del alcance de estos sprints)

- Notificaciones push/email de vencimiento próximo (hoy el aviso llega por socket al
  cliente conectado).
- Historial de auditoría de acciones de secretaría (quién sacó/reintegró cada equipo,
  con fecha) y métricas/agregados de uso del laboratorio.
- Cookies `httpOnly` + refresh tokens y panel de administración de usuarios/inventario.
