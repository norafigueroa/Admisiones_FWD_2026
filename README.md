# Admisiones FWD Costa Rica

Sistema de gestión de admisiones para FWD Costa Rica.

## Stack

- **Backend**: Node.js + Express en `server/` (puerto 3001)
- **Frontend**: React + Vite en `client/` (puerto 3000, con proxy a `/api`)
- **BD**: MySQL en `localhost:3306` (DB: `admisiones_fwd`)
- **Auth**: JWT + bcrypt
- **Email**: stub que loguea a consola (se conecta a SMTP/SendGrid en Fase 1)

## Estructura

```
Admisiones FWD/
├── server/                       Backend Express + MySQL
│   ├── src/
│   │   ├── config/db.js          Pool mysql2/promise
│   │   ├── constants/states.js   Los 17 estados + helpers
│   │   ├── db/
│   │   │   ├── schema.sql        4 tablas (users, sedes, candidates, states_history)
│   │   │   ├── init.js           Crea BD y aplica schema
│   │   │   └── seed.js           Siembra sedes + admin inicial
│   │   ├── middleware/auth.js    requireAuth (Bearer JWT) + requireRole
│   │   ├── routes/auth.js        login, change-password, me
│   │   ├── services/mailer.js    Stub con 4 plantillas
│   │   └── server.js             Express app (helmet, cors, morgan)
│   ├── .env
│   └── package.json
├── client/                       Frontend Vite + React
│   ├── src/
│   │   ├── api/client.js         Axios + interceptor JWT
│   │   ├── context/AuthContext   Login/logout/cambio de contraseña
│   │   ├── pages/                Login, ChangePassword, Dashboard
│   │   ├── App.jsx               Rutas protegidas
│   │   └── styles.css
│   ├── vite.config.js            puerto 3000 + proxy /api → 3001
│   └── package.json
└── README.md
```

## Tablas

| Tabla            | Propósito                                                  |
| ---------------- | ---------------------------------------------------------- |
| `users`          | Admin General. Soporta `must_change_password`.             |
| `sedes`          | Desamparados, Puntarenas (30 cupos/ciclo cada una).        |
| `candidates`     | Aspirantes con `seccion` (leads/entrevistas/semana_prueba) y `estado`. |
| `states_history` | Bitácora de cada cambio de estado, con flag `email_sent`.  |

## Estados (17)

| Sección       | Estados |
| ------------- | ------- |
| Leads (10)    | Contactado, Respondió, Asiste a Campus Day, Respondió - No Interesado, No Cumple Requisitos, En Espera (Excepción), No Contestó, Segunda Llamada, Llegó a Campus Day, Entrevista |
| Entrevistas (4) | Pendiente, **Aceptado**, **Rechazado**, Lista de Espera |
| Semana Prueba (3) | En Semana Prueba, **Semana Aprobada**, **Semana Rechazada** |

Los estados en **negrita** disparan email automático.

## Cómo correr

Requisitos: Node 18+, MySQL corriendo en `localhost:3306` con usuario `root` / contraseña `1234`.

### 1. Instalar dependencias (ya hecho en Fase 0)

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Inicializar la base de datos

```bash
cd server
npm run db:setup       # crea la BD, aplica schema + migraciones, siembra sedes + admin
npm run db:seed-demo   # opcional: 14 candidatos de prueba distribuidos en las 3 secciones
```

Si la BD ya existe y sólo querés aplicar las migraciones nuevas:

```bash
npm run db:migrate
```

### 3. Arrancar backend y frontend

En dos terminales:

```bash
# Terminal 1
cd server
npm run dev         # nodemon - http://localhost:3001
```

```bash
# Terminal 2
cd client
npm run dev         # vite     - http://localhost:3000
```

Abrí <http://localhost:3000> y entrá con:

- **Email**: `nfigueroa@fwdcostarica.com`
- **Contraseña temporal**: `FWD2026!`

El sistema te va a forzar el cambio de contraseña en el primer login.

## Endpoints

### Públicos / autenticación

| Método | Ruta                       | Auth | Descripción                     |
| ------ | -------------------------- | ---- | ------------------------------- |
| GET    | `/api/health`              | no   | Liveness + ping a la BD         |
| GET    | `/api/states`              | no   | Catálogo público de los 17 estados |
| POST   | `/api/auth/login`          | no   | Devuelve `{token, user, mustChangePassword}` |
| POST   | `/api/auth/change-password`| sí   | Cambia la contraseña            |
| GET    | `/api/auth/me`             | sí   | Datos del usuario actual        |

### Candidatos (Fase 1)

| Método | Ruta                                | Descripción |
| ------ | ----------------------------------- | ----------- |
| GET    | `/api/candidates`                   | Lista con filtros `seccion`, `estado`, `sede_id`, `ciclo`, `anio`, `search` y paginación |
| GET    | `/api/candidates/:id`               | Detalle + historial completo |
| POST   | `/api/candidates`                   | Crea candidato + primer registro en `states_history` |
| PUT    | `/api/candidates/:id`               | Actualiza campos (no estado) |
| POST   | `/api/candidates/:id/estado`        | Cambia estado, escribe bitácora y dispara mailer si aplica |
| DELETE | `/api/candidates/:id`               | Elimina candidato (CASCADE borra su historial) |
| GET    | `/api/candidates/meta`              | Sedes + estados (para selects del front) |

### Dashboard y vistas

| Método | Ruta                                | Descripción |
| ------ | ----------------------------------- | ----------- |
| GET    | `/api/dashboard`                    | KPIs, embudo, distribución, capacidad por sede, feed de actividad |
| GET    | `/api/sedes`                        | Lista con ocupación + conversión por ciclo |
| GET    | `/api/sedes/:id`                    | Detalle (ocupación, embudo, desglose por estado) |
| PUT    | `/api/sedes/:id`                    | Actualiza psicóloga, cupos, estado activo |
| GET    | `/api/entrevistas/week?date=`       | Calendario semanal agrupado por día |

Todos los endpoints de Fase 1 requieren `Authorization: Bearer <token>`.

## Variables de entorno

Ver `server/.env`. Lo importante:

- `DB_*` — conexión MySQL
- `JWT_SECRET` — **cambiarlo en producción**
- `INITIAL_ADMIN_*` — usados sólo por `db:seed` (no pisan un admin existente)
- `MAIL_DRIVER=stub` — en Fase 1 se cambiará a `smtp` o `sendgrid`

## Módulos del frontend (Fase 1)

- **Dashboard** (`/`) — KPIs (leads, entrevistas, aceptados, cupos), embudo, distribución por estado en las 3 secciones, capacidad por sede con barra de progreso, feed de actividad de `states_history`.
- **Leads** (`/leads`) — Tabla con búsqueda full-text por nombre/email/teléfono/cédula, filtros sede + estado, paginación 10/pg, CRUD completo en modal, cambio rápido de estado en línea.
- **Entrevistas** (`/entrevistas`) — Calendario semanal con navegación entre semanas; cada cita muestra día/número/mes y chip de estado; clic abre detalle con cambio de estado (Aceptado/Rechazado disparan email). Toggle a vista de **lista completa**. Filtros sede + estado.
- **Semana Prueba** (`/semana-prueba`) — 3 tarjetas de stats arriba (En prueba / Aprobada / Rechazada), tabla con barra de progreso de días transcurridos (sobre 7), filtros, CRUD.
- **Sedes** (`/sedes`) — Toggle por-sede / comparar. Por-sede: ocupación + cupos, embudo del ciclo, psicóloga asignada (editable inline), tasa de conversión. Comparar: tabla side-by-side de las 2 sedes.

## Próximos pasos (Fase 2+)

- Conectar mailer real (SMTP Gmail o SendGrid) — las plantillas ya están listas en `server/src/services/mailer.js`
- Multi-rol y permisos granulares (psicóloga, coordinador, etc.)
- Notificaciones in-app sobre transiciones críticas
- Exportar a Excel/CSV
- Dashboard con filtros por ciclo histórico
