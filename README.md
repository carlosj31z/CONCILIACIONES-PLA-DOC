# Recetas de Conciliación

Aplicación web que reemplaza el Excel "Cuadro de Conciliaciones": flujo de trabajo
entre **Planeamiento** y **Documentación Técnica**, con estados de cumplimiento
visuales y notificaciones por correo automáticas (el usuario solo escribe el correo
del destinatario y presiona guardar/enviar; el backend arma y despacha el correo).

- **Frontend**: React + TypeScript + Vite (`/frontend`)
- **Backend**: Node.js + Express + TypeScript + Prisma (`/backend`), empaquetado como
  función serverless de Vercel en `/api`
- **Base de datos**: PostgreSQL (probado con Supabase)
- **Correo**: Nodemailer sobre SMTP (por defecto configurado para Microsoft 365/Outlook),
  envío inline con reintento automático vía Vercel Cron

Diseño completo (esquema de BD, arquitectura de correo asíncrono, controlador clave,
topología de despliegue): ver [`docs/DISENO.md`](docs/DISENO.md).

## Requisitos

- Node.js 18+
- Un proyecto de PostgreSQL (Supabase, o cualquier Postgres local/gestionado)

## Desarrollo local

### 1. Backend

```bash
cd backend
cp .env.example .env      # completar DATABASE_URL/DIRECT_URL, SMTP_*, JWT_SECRET, CRON_SECRET
npm install                # también corre `prisma generate` (postinstall)
npx prisma migrate deploy  # aplica el esquema a la base de datos de DATABASE_URL/DIRECT_URL
npm run seed                # crea 3 usuarios de prueba (ver abajo)
npm run dev                  # http://localhost:4000
```

Para desarrollo local puedes usar directamente tu proyecto de Supabase (más simple: no
hay nada que instalar), o un Postgres local si prefieres no tocar datos de Supabase
mientras pruebas cosas. Usuarios de prueba creados por `npm run seed` (contraseña
`Cambiar123!` para todos — **cámbiala o bórralos antes de usar la app con datos reales**):

| Email                        | Rol                    |
|-------------------------------|-------------------------|
| planeamiento@empresa.com      | PLANEAMIENTO            |
| doctecnica@empresa.com        | DOC_TECNICA             |
| admin@empresa.com             | ADMIN                   |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxy /api -> localhost:4000)
```

Abre `http://localhost:5173`, ingresa con cualquiera de los usuarios de prueba.

## Despliegue en Vercel

La app se despliega como **un solo proyecto de Vercel**: el frontend se sirve como
sitio estático y el backend Express queda envuelto en una función serverless bajo
`/api` (ver `api/[...path].ts` y `vercel.json`). El detalle de esta topología está en
[`docs/DISENO.md`](docs/DISENO.md#topología-de-despliegue-vercel--supabase).

### Paso 1 — Preparar la base de datos en Supabase

Usa el proyecto de Supabase que ya tienes. Antes de aplicar el esquema, conviene
revisar que no exista ya una tabla llamada `User`, `ConciliationRecord`, etc. en el
schema `public` (la migración solo *crea* tablas nuevas, no toca las existentes, pero
sí fallaría si hay un choque de nombres con algo que ya tengas ahí).

1. En Supabase: **Project Settings → Database → Connection string**. Copia dos cadenas:
   - **Connection pooling** (modo *Transaction*, puerto `6543`) → esta es tu
     `DATABASE_URL`. Agrégale `?pgbouncer=true` al final si Supabase no lo incluye ya.
   - **Direct connection** (puerto `5432`) → esta es tu `DIRECT_URL` (solo la usa
     `prisma migrate`, nunca la app en producción).
2. Con esas dos variables en `backend/.env` (copia `backend/.env.example`), aplica el
   esquema una vez desde tu máquina:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run seed   # opcional: crea los 3 usuarios de prueba — bórralos/cámbiales la
                  # contraseña antes de dar acceso real a la app
   ```
   Este paso es manual y a propósito: aplicar un cambio de esquema a una base de datos
   que ya usas para otra cosa no debería pasar automáticamente en cada `git push`.

### Paso 2 — Crear el proyecto en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio
   `carlosj31z/CONCILIACIONES-PLA-DOC` (rama `claude/recetas-conciliacion-app-fq22at` o
   la que corresponda tras el merge).
2. **Framework Preset**: elige **Other**. Deja los campos de *Build and Output
   Settings* en su valor por defecto/heredado — `vercel.json` en la raíz del repo ya
   define `installCommand`, `buildCommand` y `outputDirectory`; si el dashboard trae
   algún valor propio escrito ahí, bórralo para que no pise la configuración del archivo.
3. **Root Directory**: déjalo en la raíz del repo (no lo cambies a `frontend` ni
   `backend` — el proyecto necesita ver ambas carpetas más `/api` y `vercel.json`).

### Paso 3 — Variables de entorno

En **Project Settings → Environment Variables**, agrega (Production, y opcionalmente
Preview si quieres probar PRs):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Connection pooling de Supabase (puerto 6543, con `?pgbouncer=true`) |
| `DIRECT_URL` | Direct connection de Supabase (puerto 5432) |
| `JWT_SECRET` | Un secreto largo y aleatorio (genera uno nuevo, no reutilices el de local) |
| `JWT_EXPIRES_IN` | `8h` (o el valor que prefieras) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.office365.com` / `587` / `false` (u otro proveedor) |
| `SMTP_USER` / `SMTP_PASSWORD` | Cuenta de servicio de Outlook/Microsoft 365 (o API key del proveedor) |
| `MAIL_FROM` | `"Recetas de Conciliación <conciliaciones@tuempresa.com>"` |
| `APP_BASE_URL` | La URL pública que te da Vercel, ej. `https://tu-proyecto.vercel.app` |
| `CRON_SECRET` | Un secreto largo y aleatorio — Vercel lo agrega solo como header `Authorization: Bearer <valor>` en cada llamada de Cron |
| `CORS_ORIGIN` | Opcional; con todo en el mismo dominio no hace falta, pero puedes fijar `APP_BASE_URL` igual por prolijidad |

> `APP_BASE_URL` necesita la URL final de Vercel, que recién existe después del primer
> deploy. Hacé un primer deploy con un valor provisorio, copiá la URL real que Vercel
> asigna, actualizá la variable, y volvé a desplegar (Vercel → Deployments → *Redeploy*).

### Paso 4 — Deploy

Con lo anterior, dale **Deploy**. Vercel va a:
1. Correr `installCommand` (instala `backend/` y `frontend/`, y `prisma generate` vía
   el `postinstall` de `backend/package.json`).
2. Correr `buildCommand` (`vite build` del frontend).
3. Empaquetar `api/[...path].ts` como función serverless (Node.js), incluyendo el
   cliente de Prisma ya generado.
4. Registrar el Cron Job de `vercel.json` (`/api/cron/process-emails`).

### Paso 5 — Verificación post-deploy

- `https://tu-proyecto.vercel.app/api/health` → debe responder `{"status":"ok"}`.
- Entra a `https://tu-proyecto.vercel.app`, inicia sesión con un usuario de prueba (o
  uno real que hayas creado), crea un requerimiento y verificá que el correo llegue
  (o que, si SMTP aún no está bien configurado, quede visible como pendiente/fallido
  sin romper el resto del flujo).
- **Vercel Cron en el plan Hobby corre 1 vez al día** — para probar el reintento sin
  esperar, podés llamarlo vos mismo:
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://tu-proyecto.vercel.app/api/cron/process-emails
  ```
  En el plan Pro podés editar `schedule` en `vercel.json` (ej. `"*/5 * * * *"` para
  cada 5 minutos).

## Flujo funcional

1. **Planeamiento** crea un requerimiento (Cod. Pro., Producto, Planta, Fecha, Motivo,
   Lotes) → estado `Pendiente de Planeamiento`.
2. Elige la ruta (**Generar receta de conciliación** / **Actualizar receta sin generar
   conciliación**), escribe los correos destino en el campo de etiquetas y envía →
   estado `En Revisión Técnica` + correo automático de nuevo requerimiento.
3. **Documentación Técnica** completa Variantes / Ejecución / Observaciones, escribe
   los correos de los interesados y marca como completada → estado `Receta Generada`
   o `Actualización Completada` + correo automático de confirmación.

Todo el historial de cambios de estado queda auditado y visible en el detalle de cada
registro.
