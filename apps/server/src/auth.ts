import "dotenv/config";
import { loadConfig } from "./config.js";
import { createAuth } from "./auth-config.js";

export const auth = createAuth(loadConfig());
