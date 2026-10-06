import { Container, Paper, Stack, Typography } from "@mui/material";

export function App() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={2}>
          <Typography variant="overline" color="primary">Umzug Ruck Zuck</Typography>
          <Typography component="h1" variant="h4">Ihre Umzugsanfrage</Typography>
          <Typography color="text.secondary">
            Das Formular-Grundgerüst ist bereit. Der abgestimmte lange Formularflow
            wird in einem späteren Arbeitspaket portiert.
          </Typography>
        </Stack>
      </Paper>
    </Container>
  );
}
