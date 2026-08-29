# Recetas de Conciliación

Aplicación web que reemplaza el Excel "Cuadro de Conciliaciones": flujo de trabajo
entre **Planeamiento** y **Documentación Técnica**, con estados de cumplimiento
visuales y notificaciones por correo automáticas (el usuario solo escribe el correo
del destinatario y presiona guardar/enviar; el backend arma y despacha el correo).

- **Frontend**: React + TypeScript + Vite (`/frontend`)
- **Backend**: Node.js + Express + TypeScript + Prisma (`/backend`)
- **Base de datos**: SQLite en desarrollo (cambia a PostgreSQL con una línea)
- **Correo**: Nodemailer sobre SMTP (por defecto configurado para Microsoft 365/Outlook)

Diseño completo (esquema de BD, arquitectura de correo asíncrono, controlador clave):
ver [`docs/DISENO.md`](docs/DISENO.md).

## Requisitos

- Node.js 18+

## 1. Backend

```bash
cd backend
cp .env.example .env      # ajustar SMTP_* y JWT_SECRET antes de producción
npm install
npx prisma migrate dev    # crea backend/prisma/dev.db y aplica el esquema
npm run seed               # crea 3 usuarios de prueba (ver abajo)
npm run dev                 # http://localhost:4000
```

Usuarios de prueba creados por `npm run seed` (contraseña `Cambiar123!` para todos):

| Email                        | Rol                    |
|-------------------------------|-------------------------|
| planeamiento@empresa.com      | PLANEAMIENTO            |
| doctecnica@empresa.com        | DOC_TECNICA             |
| admin@empresa.com             | ADMIN                   |

## 2. Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxy /api -> localhost:4000)
```

Abre `http://localhost:5173`, ingresa con cualquiera de los usuarios de prueba.

## 3. Correo saliente (Outlook / Microsoft 365)

El envío no depende de que el usuario tenga Outlook abierto: el backend despacha los
correos por su cuenta vía SMTP. Configura en `backend/.env`:

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=conciliaciones@tuempresa.com   # buzón de servicio (no personal)
SMTP_PASSWORD=...                         # App Password o credencial de la cuenta
MAIL_FROM="Recetas de Conciliación <conciliaciones@tuempresa.com>"
```

Sin credenciales válidas, los correos quedan encolados en `FALLIDO` (revisable en la
tabla `EmailLog`) y el worker los reintenta automáticamente — la app sigue funcionando
con normalidad para el resto del flujo.

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
