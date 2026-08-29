import { app } from "./app";
import { config } from "./config";
import { startEmailWorker } from "./services/email.worker";

app.listen(config.port, () => {
  console.log(`API de Recetas de Conciliación escuchando en :${config.port}`);
});

// El envío de correos corre en segundo plano, desacoplado de las requests
// HTTP: guardar un registro nunca espera a que el correo salga.
startEmailWorker();
