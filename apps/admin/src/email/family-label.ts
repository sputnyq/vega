import type { AdminOrderFamilyMember } from "@vega/domain";

export function familyLabel(member: AdminOrderFamilyMember): string {
  const parts = [`${member.isOrigin ? "Ursprung" : "Kopie"} ${member.orderNumber}`];
  if (member.workers) parts.push(`${member.workers} Helfer`);
  if (member.trucks) parts.push(`${member.trucks} LKW`);
  return parts.join(" · ");
}
