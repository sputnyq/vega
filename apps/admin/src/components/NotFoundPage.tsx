import { Button, Typography } from "@mui/material";
import { AuthCard } from "../auth/AuthCard.js";

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  return (
    <AuthCard>
      <Typography variant="overline" color="primary">Vega · Verwaltung</Typography>
      <Typography component="h1" variant="h2">404</Typography>
      <Typography variant="h5">Seite nicht gefunden</Typography>
      <Typography color="text.secondary">
        Der aufgerufene Pfad existiert nicht oder wurde verschoben.
      </Typography>
      <Button variant="contained" size="large" onClick={onHome}>
        Zur Startseite
      </Button>
    </AuthCard>
  );
}
