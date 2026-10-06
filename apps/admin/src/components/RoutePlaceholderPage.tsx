import { Paper, Stack, Typography } from "@mui/material";
import type { AdminRoute } from "../routes.js";

export function RoutePlaceholderPage({ route }: { route: AdminRoute }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
      <Stack spacing={1.5}>
        <Typography component="h2" variant="h5">{route.title}</Typography>
        <Typography color="text.secondary">{route.description}</Typography>
        <Typography variant="body2" color="text.secondary">
          Diese Vega-Ansicht ist angelegt. Die Fachfunktion wird mit der zugehörigen API umgesetzt.
        </Typography>
      </Stack>
    </Paper>
  );
}
