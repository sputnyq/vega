import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";

export function App() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={2}>
          <Typography variant="overline" color="primary">Vega · Verwaltung</Typography>
          <Typography component="h1" variant="h3">Die Admin-App ist bereit.</Typography>
          <Typography color="text.secondary">
            Dieses Grundgerüst wird in den nächsten Arbeitspaketen um Anmeldung,
            Auftragsverwaltung und Katalogpflege ergänzt.
          </Typography>
          <Box><Button href="/health" variant="contained">Server-Healthcheck</Button></Box>
        </Stack>
      </Paper>
    </Container>
  );
}
