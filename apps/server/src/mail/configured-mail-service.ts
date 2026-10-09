import type { AppConfig } from "../config.js";
import { HostingerMailClient } from "./hostinger-mail-client.js";
import { MailService } from "./mail-service.js";
import { getAppSettings } from "../settings/settings-service.js";

export function createConfiguredMailService(config: AppConfig): MailService | null {
  return config.mail ? new MailService(new HostingerMailClient(config.mail), getAppSettings) : null;
}
