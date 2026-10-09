import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, ScopedCssBaseline, Snackbar, Step, StepLabel, Stepper, ThemeProvider, useMediaQuery } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { de } from "date-fns/locale";
import { theme } from "./theme.js";
import { Column } from "./components.js";
import { createPayload, initialDraft, paths, steps, validateStep, type FormResources, type ImageDraft } from "./form-model.js";
import { loadResources, request } from "./api.js";
import { Contact, MovingStep } from "./MovingSteps.js";
import { Packaging, RequestStep, Success } from "./FinalSteps.js";
import { ImageUploader } from "./ImageUploader.js";

export function App() {
  const [draft, setDraft] = useState(initialDraft);
  const [resources, setResources] = useState<FormResources | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    void loadResources(controller.signal).then(setResources).catch((reason: unknown) => {
      if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Das Formular konnte nicht geladen werden.");
    });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const hash = () => {
      const path = window.location.hash.replace(/^#\/?/, "");
      const index = paths.indexOf(path);
      if (index >= 0) {
        for (let step = 0; step < index; step++) {
          const message = validateStep(draftRef.current, step);
          if (message) { setError(message); setActiveStep(step); history.replaceState(null, "", `#/${paths[step]}`); return; }
        }
        setActiveStep(index);
      } else if (path !== "erfolg") { setActiveStep(0); }
    };
    hash();
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  const navigate = (index: number) => {
    if (submitting) return;
    if (index > activeStep) {
      const message = validateStep(draft, activeStep);
      if (message) { setError(message); return; }
    }
    setActiveStep(index);
    window.location.hash = `/${paths[index]}`;
    root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onImages = useCallback((images: ImageDraft[]) => setDraft((current) => ({ ...current, images })), []);
  const onBusy = useCallback((busy: boolean) => setImagesBusy(busy), []);
  const submitLock = useRef(false);
  const submit = async () => {
    if (!resources || submitLock.current || imagesBusy) return;
    for (let step = 0; step < 3; step++) {
      const message = validateStep(draft, step);
      if (message) { setError(message); navigate(step); return; }
    }
    if (!draft.privacyAccepted || !resources.config.privacyUrl) { setError("Bitte bestätigen Sie die Datenschutzerklärung."); return; }
    submitLock.current = true; setSubmitting(true); setError("");
    try {
      await request<{ orderNumber: number }>("/api/public/orders", createPayload(draft, resources));
      setSuccess(true);
      if (resources.config.successUrl) window.location.assign(resources.config.successUrl);
      else window.location.hash = "/erfolg";
      root.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Die Anfrage konnte nicht gesendet werden. Ihre Eingaben bleiben erhalten."); }
    finally { submitLock.current = false; setSubmitting(false); }
  };
  const props = resources ? { draft, setDraft, resources } : null;
  return <ThemeProvider theme={theme}><LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
    <ScopedCssBaseline className="vega-customer-form" sx={{ fontFamily: theme.typography.fontFamily }}>
      <Box ref={root} sx={{ p: 2, m: "auto", maxWidth: 900 }}>
        {!resources ? <Box sx={{ textAlign: "center", py: 6 }}>{loadError
          ? <><Alert severity="error">{loadError}</Alert><Button onClick={() => setRetry((current) => current + 1)}>Erneut versuchen</Button></>
          : <CircularProgress aria-label="Formular wird geladen" />}</Box>
          : <Column gap={4}>
            {!success && <Stepper activeStep={activeStep} sx={{ alignSelf: "center", width: "100%" }}>{steps.map((label) => <Step key={label}><StepLabel>{narrow ? null : label}</StepLabel></Step>)}</Stepper>}
            {success ? <Success /> : <Box component="fieldset" disabled={submitting} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
              {activeStep === 0 && <Contact {...props!} />}
              {activeStep === 1 && <MovingStep {...props!} departure />}
              {activeStep === 2 && <MovingStep {...props!} departure={false} />}
              {activeStep === 3 && <Packaging {...props!} />}
              <Box sx={{ display: activeStep === 4 ? "block" : "none" }}>
                <RequestStep {...props!} submitting={submitting} imagesBusy={imagesBusy} onSubmit={() => void submit()}
                  uploader={<ImageUploader available={resources.config.uploadsAvailable} onImages={onImages} onBusy={onBusy} />} />
              </Box>
            </Box>}
            {!success && <Box sx={{ display: "flex", gap: 4, justifyContent: "center" }}>
              <Button size="large" variant="outlined" disabled={activeStep === 0 || submitting} onClick={() => navigate(activeStep - 1)}>zurück</Button>
              {activeStep < 4 && <Button size="large" variant="contained" disabled={submitting} onClick={() => navigate(activeStep + 1)}>weiter</Button>}
            </Box>}
          </Column>}
        <Snackbar open={Boolean(error)} autoHideDuration={8000} onClose={() => setError("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
          <Alert severity="error" onClose={() => setError("")}>{error}</Alert>
        </Snackbar>
      </Box>
    </ScopedCssBaseline>
  </LocalizationProvider></ThemeProvider>;
}
