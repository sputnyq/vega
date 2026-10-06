export interface AppConfig {
  appBaseUrl: URL;
  corsAllowedOrigins: string[];
  host: string;
  nodeEnv: string;
  port: number;
}

function parseOriginList(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  return value.split(",").map((entry) => {
    const candidate = entry.trim();
    if (candidate === "*") {
      throw new Error("CORS_ALLOWED_ORIGINS darf keinen Wildcard-Origin enthalten.");
    }

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`Ungültiger Origin in CORS_ALLOWED_ORIGINS: ${candidate}`);
    }

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== candidate ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(`CORS-Origin muss exakt Schema, Host und optionalen Port enthalten: ${candidate}`);
    }

    return parsed.origin;
  });
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const rawBaseUrl = env.APP_BASE_URL ?? "http://localhost:3000";
  let appBaseUrl: URL;

  try {
    appBaseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("APP_BASE_URL muss eine gültige absolute URL sein.");
  }

  if (
    !["http:", "https:"].includes(appBaseUrl.protocol) ||
    appBaseUrl.username ||
    appBaseUrl.password
  ) {
    throw new Error("APP_BASE_URL muss eine HTTP(S)-URL ohne Zugangsdaten sein.");
  }

  const corsAllowedOrigins = parseOriginList(env.CORS_ALLOWED_ORIGINS);
  if (nodeEnv === "production") {
    if (!env.APP_BASE_URL) {
      throw new Error("APP_BASE_URL muss in Produktion explizit gesetzt sein.");
    }
    if (appBaseUrl.protocol !== "https:") {
      throw new Error("APP_BASE_URL muss in Produktion HTTPS verwenden.");
    }
    if (corsAllowedOrigins.length === 0) {
      throw new Error("CORS_ALLOWED_ORIGINS muss in Produktion explizit gesetzt sein.");
    }
    if (corsAllowedOrigins.some((origin) => new URL(origin).protocol !== "https:")) {
      throw new Error("CORS-Origins müssen in Produktion HTTPS verwenden.");
    }
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT muss eine ganze Zahl zwischen 1 und 65535 sein.");
  }

  return {
    appBaseUrl,
    corsAllowedOrigins,
    host: env.HOST ?? "0.0.0.0",
    nodeEnv,
    port,
  };
}
