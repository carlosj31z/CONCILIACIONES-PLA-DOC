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
mientras pruebas cosas. `npm run seed` crea/actualiza el usuario admin y las cuentas
reales de Planeamiento y Documentación Técnica (ver `backend/prisma/seed.ts`).

**El acceso es solo con el correo, sin contraseña**: cualquier cuenta activa en la
tabla `User` puede ingresar escribiendo su email. El alta de nuevas cuentas la hace
un ADMIN desde la pestaña **Usuarios**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxy /api -> localhost:4000)
```

Abre `http://localhost:5173`, ingresa con el correo de cualquiera de las cuentas
creadas por el seed (no pide contraseña).

### Administrar usuarios

El usuario `admin@empresa.com` (rol `ADMIN`) ve una pestaña **Usuarios** en el menú
lateral, no visible para los demás roles: ahí puede crear cuentas nuevas (nombre,
correo, puesto y rol), cambiar el rol de cualquiera y activar/desactivar accesos —
sin tocar la base de datos directamente. Un admin no puede desactivarse ni cambiarse
el rol a sí mismo (para no quedarse sin acceso por accidente).

## Despliegue en Vercel

La app se despliega como **un solo proyecto de Vercel con dos servicios**: al importar
el repo, Vercel detecta automáticamente `frontend/` (Vite) y `backend/` (Express) como
apps independientes y arma la configuración "multi-service" — `vercel.json` en la raíz
ya trae ese formato. El detalle de esta topología está en
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
   npm run seed   # crea/actualiza el admin y las cuentas reales de Planeamiento y
                  # Documentación Técnica (ver backend/prisma/seed.ts)
   ```
   Este paso es manual y a propósito: aplicar un cambio de esquema a una base de datos
   que ya usas para otra cosa no debería pasar automáticamente en cada `git push`.

### Paso 2 — Crear el proyecto en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio
   `carlosj31z/CONCILIACIONES-PLA-DOC` (rama `claude/recetas-conciliacion-app-fq22at` o
   la que corresponda tras el merge).
2. Vercel va a mostrar la pantalla de **"New Project"** con un **Application Preset**
   en **"Services"**, listando `frontend` (Vite) y `backend` (Express) ya detectados, y
   una vista previa del `vercel.json` requerido — debe coincidir con el que ya está en
   la raíz del repo. Si Vercel dice que falta o no coincide, dale **Refresh** (lee el
   archivo del último commit de la rama); no necesitás escribir nada a mano ahí.
3. No cambies el **Project Root** de cada servicio (`frontend` y `backend` ya vienen
   con su `root` correcto desde `vercel.json`).

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
| `MAIL_FROM` | `"Conciliaciones <conciliaciones@tuempresa.com>"` |
| `APP_BASE_URL` | La URL pública que te da Vercel, ej. `https://tu-proyecto.vercel.app` |
| `CRON_SECRET` | Un secreto largo y aleatorio — Vercel lo agrega solo como header `Authorization: Bearer <valor>` en cada llamada de Cron |
| `CORS_ORIGIN` | Opcional; con todo en el mismo dominio no hace falta, pero puedes fijar `APP_BASE_URL` igual por prolijidad |
| `SAP_MAESTRO_SUPABASE_URL` / `SAP_MAESTRO_SUPABASE_ANON_KEY` | Opcional — solo si el proyecto de Supabase del Maestro de Materiales de SAP (usado por la búsqueda de Cód. Producto/Producto al crear un requerimiento) cambia de URL o de "publishable key"; por defecto usa los mismos valores que ya usa esa herramienta |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Proyecto de Supabase donde viven los archivos adjuntos de las notas (ver Paso 3b). Sin ellas la app funciona igual, pero adjuntar un archivo a una nota responde 503 |
| `SUPABASE_STORAGE_BUCKET` | Opcional; por defecto `notas-adjuntos` |

> `APP_BASE_URL` necesita la URL final de Vercel, que recién existe después del primer
> deploy. Hacé un primer deploy con un valor provisorio, copiá la URL real que Vercel
> asigna, actualizá la variable, y volvé a desplegar (Vercel → Deployments → *Redeploy*).

### Paso 3b — Bucket para los archivos de las notas

Las notas de un requerimiento admiten imágenes y documentos. Los archivos **no** se
guardan en la base de datos (Postgres es caro para binarios y el límite de cuerpo de
una función de Vercel es de 4.5 MB); van a Supabase Storage, y en la base solo queda
la ruta.

1. En Supabase → **Storage → New bucket**.
   - Nombre: `notas-adjuntos` (o el que pongas en `SUPABASE_STORAGE_BUCKET`).
   - **Public bucket: NO.** Tiene que quedar privado: los adjuntos de una nota privada
     solo los puede abrir su autor, y eso se pierde si cualquiera con la URL entra.
2. En Supabase → **Project Settings → API**, copia:
   - **Project URL** → `SUPABASE_URL`.
   - **`service_role` key** (la secreta, no la `anon`) → `SUPABASE_SERVICE_ROLE_KEY`.
3. Cargá las dos en Vercel (Paso 3) y en tu `backend/.env` para desarrollo.

> La `service_role` key salta las políticas de RLS, así que **solo puede vivir en el
> backend**: nunca la pongas en el frontend ni en una variable `VITE_*`. Quien puede
> abrir cada archivo lo decide el backend, mirando quién escribió la nota; el navegador
> nunca recibe la clave, solo un enlace firmado que vence en una hora.

El backend acepta imágenes (`png`, `jpeg`, `gif`, `webp`), PDF, Word, Excel y texto
plano, hasta **4 MB por archivo**. Un archivo más grande devuelve un 413 con el motivo,
y un tipo no permitido, un 415.

### Paso 4 — Deploy

Con lo anterior, dale **Deploy**. Vercel va a:
1. Instalar y buildear el servicio `frontend` (`npm install` + `npm run build`, Vite)
   y servirlo como sitio estático.
2. Instalar y buildear el servicio `backend` (`npm install` — corre `prisma generate`
   vía el `postinstall` de `backend/package.json` — y `npm run build`, que compila
   TypeScript) y arrancarlo con `npm start` (`node dist/server.js`), como un servicio
   persistente escuchando en el puerto que Vercel le asigna.
3. Aplicar los `rewrites` de `vercel.json`: todo `/api/*` va al servicio `backend`;
   `/assets/*`, `/media/*` y `/favicon.png` se sirven tal cual desde el `frontend`; y
   **cualquier otra dirección se resuelve con `/index.html`** de ese mismo servicio.
   Esa última regla es la que hace que recargar una ruta como `/registros/nuevo` no
   dé el 404 de Vercel: la ruta solo existe en el enrutador del navegador, no como
   archivo, así que sin la reescritura el hosting busca un archivo que no está.
   Como red de seguridad, el build también deja un `404.html` que devuelve al inicio
   si por lo que sea el hosting llega a servir su propia página de "no encontrado".
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

1. **Planeamiento** crea un requerimiento (Cód. Producto, Producto, Planta 1/2, Fecha
   de conciliación, Motivo, Materiales a conciliar, Asuntos regulatorios) → estado
   `Pendiente de Planeamiento`. Puede editar o borrar el requerimiento mientras siga
   en curso.
2. Elige la ruta (**Generar receta de conciliación** / **Actualizar receta sin generar
   conciliación**); los destinatarios de la notificación se prellenan con todos los
   usuarios y se envía → estado `En Revisión por Documentación Técnica` + correo
   automático de nuevo requerimiento.
3. **Documentación Técnica** completa Variantes / Ejecución / Observaciones y marca
   como completada → estado `Entregada por Documentación Técnica` + correo de
   confirmación; o, si no es posible generarla, la rechaza con un motivo → estado
   `Rechazada por Documentación Técnica` (cierra el requerimiento y avisa a quien lo
   creó).
4. **Planeamiento** revisa la entrega y decide: **concluir** (estado `Concluida`,
   cierre final) o **rechazar con motivo** (vuelve a `En Revisión por Documentación
   Técnica` para que se rehaga).

Todo el historial de cambios de estado queda auditado y visible en el detalle de cada
registro, junto con un stepper ("Ver flujo") que muestra en qué etapa está cada
requerimiento en tiempo real.

### Notas de un requerimiento

En el detalle de cada requerimiento, tanto Planeamiento como Documentación Técnica
pueden dejar **notas** con imágenes y documentos adjuntos:

- **Compartida**: la ve cualquiera que abra ese requerimiento.
- **Privada** (*Solo yo*): la ve únicamente quien la escribió. Se distingue en pantalla
  por una franja lateral y su insignia.

Editar el texto, cambiar la visibilidad, adjuntar archivos, quitarlos o borrar la nota
**solo lo puede hacer quien la creó** — ni siquiera un administrador. La interfaz
esconde esos botones en las notas ajenas, y el backend además lo rechaza con un 403,
así que la restricción no depende de que el navegador se porte bien.
