import { useEffect, useState, type MouseEvent } from "react";
import { Chip, Stack, Typography } from "@mui/material";
import type { AdminOrderFamilyMember } from "@vega/domain";
import { apiRequest } from "../api/api-request.js";
import { familyLabel } from "../email/family-label.js";

interface OrderFamilyLinksProps {
  orderNumber: number;
  dirty: boolean;
  navigate: (path: string) => void;
}

/** Links between an order and its copies; hidden for orders without copies. */
export function OrderFamilyLinks({ orderNumber, dirty, navigate }: OrderFamilyLinksProps) {
  const [members, setMembers] = useState<AdminOrderFamilyMember[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: AdminOrderFamilyMember[] }>(`/api/admin/orders/${orderNumber}/family`, "GET", undefined, { signal: controller.signal })
      .then(({ items }) => setMembers(items))
      // The links are a navigation aid; the editor stays usable without them.
      .catch(() => { if (!controller.signal.aborted) setMembers([]); });
    return () => controller.abort();
  }, [orderNumber]);

  if (members.length < 2) return null;

  function open(target: number) {
    if (dirty && !window.confirm("Ungespeicherte Änderungen gehen verloren. Trotzdem wechseln?")) return;
    navigate(`/edit/${target}`);
  }

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }} component="nav" aria-label="Auftragsfamilie">
      <Typography variant="body2" color="text.secondary">Auftragsfamilie:</Typography>
      {members.map((member) => {
        const current = member.orderNumber === orderNumber;
        const label = `${familyLabel(member)}${member.archived ? " (archiviert)" : ""}`;
        return current || member.archived
          ? <Chip key={member.orderNumber} size="small" label={label} color={current ? "primary" : "default"} variant={current ? "filled" : "outlined"} {...(current ? { "aria-current": "page" as const } : {})} />
          : <Chip key={member.orderNumber} size="small" label={label} variant="outlined" clickable component="a" href={`/edit/${member.orderNumber}`}
            onClick={(event: MouseEvent) => { event.preventDefault(); open(member.orderNumber); }} />;
      })}
    </Stack>
  );
}
