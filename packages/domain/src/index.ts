/** Anwendungsrollen; Berechtigungen werden serverseitig durchgesetzt. */
export type UserRole = "Admin" | "Kundenberater";

/** Minimaler öffentlicher Statusvertrag des Express-Healthchecks. */
export interface HealthStatus {
  status: "ok";
  service: "vega";
}
