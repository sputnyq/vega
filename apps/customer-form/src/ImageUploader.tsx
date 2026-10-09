import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardActions, CardMedia, CircularProgress, Grid, IconButton } from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutlineOutlined";
import { Column } from "./components.js";
import { request } from "./api.js";
import type { ImageDraft } from "./form-model.js";

const MAX_BYTES = 10 * 1024 * 1024;
export function imageDimensions(width: number, height: number) {
  const ratio = Math.min(1, 2000 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Bitte wählen Sie ausschließlich Bilddateien (keine SVG-Dokumente).");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("Das Bildformat konnte nicht gelesen werden. Bitte verwenden Sie JPEG, PNG oder WebP."); }
  try {
    const size = imageDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Die Bildkomprimierung ist in diesem Browser nicht verfügbar.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) =>
      value ? resolve(value) : reject(new Error("Das Bild konnte nicht komprimiert werden.")), "image/jpeg", 0.8));
    if (blob.size > MAX_BYTES) throw new Error("Das komprimierte Bild überschreitet 10 MB.");
    return blob;
  } finally { bitmap.close(); }
}

interface Job { id: string; file: File; preview: string; status: "uploading" | "done" | "failed"; error?: string; claim?: ImageDraft }
interface Policy { id: string; token: string; url: string; fields: Record<string, string> }

export function ImageUploader({ available, onImages, onBusy }: { available: boolean; onImages: (images: ImageDraft[]) => void; onBusy: (busy: boolean) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const currentJobs = useRef(jobs);
  const controllers = useRef(new Map<string, AbortController>());
  currentJobs.current = jobs;
  useEffect(() => {
    onImages(jobs.flatMap((job) => job.claim ? [job.claim] : []));
    onBusy(jobs.some((job) => job.status !== "done"));
  }, [jobs, onImages, onBusy]);
  useEffect(() => () => {
    for (const controller of controllers.current.values()) controller.abort();
    for (const job of currentJobs.current) URL.revokeObjectURL(job.preview);
  }, []);
  async function upload(job: Job) {
    const controller = new AbortController();
    controllers.current.set(job.id, controller);
    setJobs((current) => current.map((entry) => entry.id === job.id ? { ...entry, status: "uploading", error: "" } : entry));
    const timer = setTimeout(() => controller.abort(new Error("Der Bildupload hat zu lange gedauert. Bitte versuchen Sie es erneut.")), 120_000);
    try {
      const jpeg = await compressImage(job.file);
      if (controller.signal.aborted) return;
      const policy = await request<Policy>("/api/public/uploads", { size: jpeg.size, contentType: "image/jpeg" }, controller.signal);
      const body = new FormData();
      for (const [key, value] of Object.entries(policy.fields)) body.append(key, value);
      body.append("file", jpeg, "image.jpg");
      const response = await fetch(policy.url, { method: "POST", body, signal: controller.signal });
      if (!response.ok) throw new Error("Der Bildspeicher hat den Upload abgewiesen. Bitte versuchen Sie es erneut.");
      await request(`/api/public/uploads/${policy.id}/complete`, { token: policy.token }, controller.signal);
      const preview = URL.createObjectURL(jpeg);
      setJobs((current) => {
        if (!current.some((entry) => entry.id === job.id)) { URL.revokeObjectURL(preview); return current; }
        URL.revokeObjectURL(job.preview);
        return current.map((entry) => entry.id === job.id ? {
          ...entry, preview, status: "done", claim: { id: policy.id, token: policy.token, preview },
        } : entry);
      });
    } catch (error) {
      setJobs((current) => current.map((entry) => entry.id === job.id ? {
        ...entry, status: "failed", error: controller.signal.aborted
          ? "Der Upload wurde abgebrochen oder hat zu lange gedauert. Bitte versuchen Sie es erneut."
          : error instanceof Error ? error.message : "Der Bildupload ist fehlgeschlagen.",
      } : entry));
    } finally { clearTimeout(timer); controllers.current.delete(job.id); }
  }
  const remove = (job: Job) => {
    controllers.current.get(job.id)?.abort();
    URL.revokeObjectURL(job.preview);
    setJobs((current) => current.filter((entry) => entry.id !== job.id));
  };
  return <Column>
    {!available && <Alert severity="warning">Der Google-Bildspeicher ist noch nicht eingerichtet. Bilder können derzeit nicht angehängt werden.</Alert>}
    <Button component="label" variant="outlined" disabled={!available} sx={{ alignSelf: "center" }}>
      Jetzt Bilder anhängen
      <input hidden accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif" multiple type="file" onChange={(event) => {
        const next = Array.from(event.target.files ?? []).map((file): Job => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "uploading" }));
        event.target.value = "";
        setJobs((current) => [...current, ...next]);
        for (const job of next) void upload(job);
      }} />
    </Button>
    <Grid container spacing={2}>{jobs.map((job) => <Grid key={job.id} size={{ xs: 12, sm: 6, md: 4 }}>
      <Card elevation={2} sx={{ p: 1 }}>
        <CardMedia component="img" sx={{ height: 200, objectFit: "cover" }} src={job.preview} alt={job.file.name} />
        {job.status === "failed" && <Alert severity="error">{job.error}</Alert>}
        <CardActions sx={{ justifyContent: "center" }}>
          {job.status === "uploading" && <CircularProgress size={24} aria-label="Bild wird hochgeladen" />}
          {job.status === "failed" && <Button onClick={() => void upload(job)}>Erneut versuchen</Button>}
          <IconButton color="error" aria-label={`Bild ${job.file.name} entfernen`} onClick={() => remove(job)}><DeleteOutline /></IconButton>
        </CardActions>
      </Card>
    </Grid>)}</Grid>
  </Column>;
}
