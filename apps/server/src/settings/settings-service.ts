import type { AppSettingsDto, CustomerFormConfig } from "@vega/domain";
import { prisma } from "../prisma.js";
import type { AppConfig } from "../config.js";

export async function getAppSettings(): Promise<AppSettingsDto> {
  const row = await prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    revision: row.revision, boxCbm: row.boxCbm === null ? null : Number(row.boxCbm),
    kleiderboxCbm: row.kleiderboxCbm === null ? null : Number(row.kleiderboxCbm),
    origin: row.origin, dataPrivacyUrl: row.dataPrivacyUrl, successUrl: row.successUrl,
    boxCalculatorUrl: row.boxCalculatorUrl, companyEmail: row.companyEmail,
    emailFromName: row.emailFromName, emailFromAddress: row.emailFromAddress,
  };
}
export function customerFormSettings(settings: AppSettingsDto, config: AppConfig): CustomerFormConfig {
  return {
    privacyUrl: settings.dataPrivacyUrl, boxCalculatorUrl: settings.boxCalculatorUrl, successUrl: settings.successUrl,
    boxVolume: settings.boxCbm, wardrobeBoxVolume: settings.kleiderboxCbm,
    uploadsAvailable: Boolean(config.gcs), placesAvailable: Boolean(config.googlePlacesKey),
  };
}
export async function saveAppSettings(settings: AppSettingsDto): Promise<AppSettingsDto | null> {
  const { revision, ...data } = settings;
  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.appSettings.updateMany({
      where: { id: 1, revision }, data: { ...data, revision: { increment: 1 } },
    });
    if (updated.count !== 1) return null;
    return { ...settings, revision: revision + 1 };
  });
}
