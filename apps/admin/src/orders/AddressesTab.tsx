import { AddOutlined, CompareArrowsOutlined, RemoveOutlined } from "@mui/icons-material";
import { Alert, Box, Grid, IconButton, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import type { OrderDetailsInput } from "@vega/domain";
import { AddressFields } from "./AddressFields.js";
import { createEmptyAddress, type OrderFormValue } from "./order-form-types.js";
import { RouteDistance } from "./RouteDistance.js";

interface AddressesTabProps {
  value: OrderFormValue;
  update: (patch: Partial<OrderFormValue>) => void;
  onDetailsChange: (details: OrderDetailsInput) => void;
}

export function AddressesTab({ value, update, onDetailsChange }: AddressesTabProps) {
  const { details } = value;

  function toggleSecondary(kind: "from" | "to") {
    if (kind === "from") {
      if (details.showSecondaryFrom) {
        const { secondaryFrom: _removed, ...rest } = details;
        onDetailsChange({ ...rest, showSecondaryFrom: false });
      } else {
        onDetailsChange({ ...details, secondaryFrom: createEmptyAddress(), showSecondaryFrom: true });
      }
      return;
    }
    if (details.showSecondaryTo) {
      const { secondaryTo: _removed, ...rest } = details;
      onDetailsChange({ ...rest, showSecondaryTo: false });
    } else {
      onDetailsChange({ ...details, secondaryTo: createEmptyAddress(), showSecondaryTo: true });
    }
  }

  function exchange(kind: "from" | "to") {
    if (kind === "from" && details.secondaryFrom) {
      onDetailsChange({ ...details, secondaryFrom: value.from });
      update({ from: details.secondaryFrom });
    } else if (kind === "to" && details.secondaryTo) {
      onDetailsChange({ ...details, secondaryTo: value.to });
      update({ to: details.secondaryTo });
    }
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Entfernung</Typography>
          <TextField
            type="number"
            label="Entfernung in km"
            value={details.distanceKm}
            onChange={(event) => onDetailsChange({ ...details, distanceKm: Math.max(0, Number(event.target.value)) })}
            slotProps={{ htmlInput: { min: 0, max: 10000, step: 1 } }}
          />
          <RouteDistance value={value} onDistance={(distanceKm) => onDetailsChange({ ...details, distanceKm })} />
        </Stack>
      </Paper>
      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: "100%" }}>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography component="h2" variant="h6" color="error.main">
                  {details.showSecondaryFrom ? "1. Beladestelle" : "Beladestelle"}
                </Typography>
                <Tooltip title={details.showSecondaryFrom ? "2. Beladestelle entfernen" : "Beladestelle hinzufügen"}>
                  <IconButton color={details.showSecondaryFrom ? "error" : "success"} onClick={() => toggleSecondary("from")} aria-label="Weitere Beladestelle umschalten">
                    {details.showSecondaryFrom ? <RemoveOutlined /> : <AddOutlined />}
                  </IconButton>
                </Tooltip>
              </Box>
              <AddressFields title="" value={value.from} onChange={(from) => update({ from: { ...value.from, ...from } })} />
              {details.showSecondaryFrom && details.secondaryFrom && (
                <>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Tooltip title="1. und 2. Beladestelle tauschen">
                      <IconButton onClick={() => exchange("from")} aria-label="Beladestellen tauschen"><CompareArrowsOutlined /></IconButton>
                    </Tooltip>
                  </Box>
                  <AddressFields title="2. Beladestelle" value={details.secondaryFrom} onChange={(secondaryFrom) => {
                    const current = details.secondaryFrom;
                    if (current) onDetailsChange({ ...details, secondaryFrom: { ...current, ...secondaryFrom } });
                  }} />
                </>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: "100%" }}>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography component="h2" variant="h6" color="primary.main">
                  {details.showSecondaryTo ? "1. Entladestelle" : "Entladestelle"}
                </Typography>
                <Tooltip title={details.showSecondaryTo ? "2. Entladestelle entfernen" : "Entladestelle hinzufügen"}>
                  <IconButton color={details.showSecondaryTo ? "error" : "success"} onClick={() => toggleSecondary("to")} aria-label="Weitere Entladestelle umschalten">
                    {details.showSecondaryTo ? <RemoveOutlined /> : <AddOutlined />}
                  </IconButton>
                </Tooltip>
              </Box>
              <AddressFields title="" value={value.to} onChange={(to) => update({ to: { ...value.to, ...to } })} />
              {details.showSecondaryTo && details.secondaryTo && (
                <>
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Tooltip title="1. und 2. Entladestelle tauschen">
                      <IconButton onClick={() => exchange("to")} aria-label="Entladestellen tauschen"><CompareArrowsOutlined /></IconButton>
                    </Tooltip>
                  </Box>
                  <AddressFields title="2. Entladestelle" value={details.secondaryTo} onChange={(secondaryTo) => {
                    const current = details.secondaryTo;
                    if (current) onDetailsChange({ ...details, secondaryTo: { ...current, ...secondaryTo } });
                  }} />
                </>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
