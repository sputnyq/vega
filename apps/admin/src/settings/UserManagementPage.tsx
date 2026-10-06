import { Alert, Paper, Stack, Typography } from "@mui/material";

export function UserManagementPage() {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, maxWidth: 900 }}>
      <Stack spacing={1.5}>
        <Typography component="h2" variant="h5">User Management</Typography>
        <Typography color="text.secondary">
          Mitarbeiterkonten anlegen, sperren und den Rollen Admin oder Kundenberater zuordnen.
        </Typography>
        <Alert severity="info">
          Die Verwaltungsroute ist vorbereitet. Kontenverwaltung und Passwort-Reset werden erst
          aktiv, wenn die dafür autorisierten Vega-APIs und der serverseitige Mailversand vorliegen.
        </Alert>
      </Stack>
    </Paper>
  );
}
