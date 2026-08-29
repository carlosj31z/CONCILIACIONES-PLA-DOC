import { app } from "./app";
import { config } from "./config";
import { startEmailWorker } from "./services/email.worker";

app.listen(config.port, () => {
  console.log(`API de Recetas de Conciliación escuchando en :${config.port}`);
});

// Solo en desarrollo local: además del envío inline que ya hacen los
// controladores, este worker en background reintenta cada pocos segundos
// cualquier correo que haya quedado FALLIDO, emulando el Cron Job que en
// producción (Vercel) cumple ese mismo rol.
startEmailWorker();
