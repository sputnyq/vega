import "dotenv/config";
import { createApp } from "./app.js";
import { legacyGoogleKeyVariables, loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp(config);

const legacyGoogleKeys = legacyGoogleKeyVariables();
if (legacyGoogleKeys.length > 0) {
  console.warn(`Ignoriert: ${legacyGoogleKeys.join(", ")}. Verwenden Sie GOOGLE_MAPS_API_KEY.`);
}

app.listen(config.port, config.host, () => {
  console.info(`Vega-Server hört auf ${config.host}:${config.port} (${config.nodeEnv}).`);
});
