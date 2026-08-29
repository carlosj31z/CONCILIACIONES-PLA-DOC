import { app } from "./app";
import { config } from "./config";
import { startEmailWorker } from "./services/email.worker";

app.listen(config.port, () => {
  console.log(`API de Conciliaciones escuchando en :${config.port}`);
});

// Además del envío inline que ya hacen los controladores, este worker en
// background reintenta cada pocos segundos cualquier correo que haya quedado
// FALLIDO. Corre tanto en desarrollo local como en producción (el backend se
// despliega como servicio persistente); el Cron Job de /api/cron/process-emails
// es el respaldo si el proceso llegara a reiniciarse.
startEmailWorker();
