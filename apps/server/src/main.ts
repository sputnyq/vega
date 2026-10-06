import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, config.host, () => {
  console.info(`Vega-Server hört auf ${config.host}:${config.port} (${config.nodeEnv}).`);
});
