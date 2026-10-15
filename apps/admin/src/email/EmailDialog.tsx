import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatUnderlined,
  Redo,
  Undo,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import type { AdminOrderFamilyMember, EmailDraft, OrderEmailKind, StaffEmailSendResult } from "@vega/domain";
import { apiRequest, type ApiEnvelope } from "../api/api-request.js";
import { AdminAlert as Alert, useAdminNotification } from "../components/AdminNotifications.js";
import { familyLabel } from "./family-label.js";

export type EmailTarget =
  | { type: "order"; orderNumber: number; kind: OrderEmailKind }
  | { type: "invoice"; id: string }
  | { type: "credit"; id: string }
  | { type: "reminder"; id: string; level: number };

const TITLES: Record<OrderEmailKind | "invoice" | "credit", string> = {
  offer: "Angebot versenden",
  "offer-pair": "2 Angebote versenden",
  decline: "Absage versenden",
  invoice: "Rechnung versenden",
  credit: "Gutschrift versenden",
};

const DOCUMENT_PATHS = { invoice: "/api/admin/invoices", credit: "/api/admin/credits", reminder: "/api/admin/reminders" } as const;

interface EmailDialogProps {
  target: EmailTarget;
  onClose: () => void;
  /** Called after the mail was accepted (sent or queued for retry). */
  onSent?: () => void;
}

/**
 * Shared send dialog. The server builds the draft from the saved document,
 * renders the PDF attachments at send time and is authoritative for recipient,
 * family and role checks; the dialog only edits recipient, subject and text.
 */
export function EmailDialog({ target, onClose, onSent }: EmailDialogProps) {
  const notify = useAdminNotification();
  const isPair = target.type === "order" && target.kind === "offer-pair";
  const [partners, setPartners] = useState<AdminOrderFamilyMember[]>();
  const [partner, setPartner] = useState<number>();
  const [draft, setDraft] = useState<EmailDraft>();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const basePath = target.type === "order" ? `/api/admin/orders/${target.orderNumber}` : `${DOCUMENT_PATHS[target.type]}/${encodeURIComponent(target.id)}`;
  const ownOrderNumber = target.type === "order" ? target.orderNumber : undefined;
  const query = target.type === "order" ? `?kind=${target.kind}${isPair ? `&partner=${partner ?? ""}` : ""}` : "";

  useEffect(() => {
    if (!isPair) return;
    const controller = new AbortController();
    apiRequest<{ items: AdminOrderFamilyMember[] }>(`${basePath}/family`, "GET", undefined, { signal: controller.signal })
      .then(({ items }) => {
        const options = items.filter((item) => item.orderNumber !== ownOrderNumber && !item.archived);
        setPartners(options);
        setPartner(options.find((item) => item.isOrigin)?.orderNumber ?? options[0]?.orderNumber);
        if (!options.length) setError("In dieser Auftragsfamilie gibt es keinen weiteren, nicht archivierten Auftrag.");
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorText(reason)); });
    return () => controller.abort();
  }, [basePath, isPair, ownOrderNumber]);

  useEffect(() => {
    if (isPair && partner === undefined) return;
    const controller = new AbortController();
    setDraft(undefined);
    setError("");
    apiRequest<EmailDraft>(`${basePath}/email-draft${query}`, "GET", undefined, { signal: controller.signal })
      .then((loaded) => { setDraft(loaded); setTo(loaded.to); setSubject(loaded.subject); setHtml(loaded.contentHtml); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorText(reason)); });
    return () => controller.abort();
  }, [basePath, isPair, partner, query]);

  async function send() {
    if (sending || !draft) return;
    setSending(true);
    setError("");
    // One key per click: a retried request of the same click cannot send twice,
    // while a later click after editing creates a new mail.
    const body = {
      to, subject, contentHtml: html, idempotencyKey: crypto.randomUUID(),
      ...(target.type === "order" ? { kind: target.kind, ...(isPair && partner !== undefined ? { partnerOrderNumber: partner } : {}) } : {}),
    };
    try {
      const response = await fetch(`${basePath}/emails`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json() as ApiEnvelope<StaffEmailSendResult>;
      if (!response.ok || !result.data) {
        setError(result.error?.issues?.map((issue) => issue.message).join(" · ") || result.error?.message || "Die E-Mail konnte nicht versendet werden.");
        return;
      }
      if (result.data.status === "SENT") notify("success", "E-Mail versendet.");
      else notify("warning", "Der Mailanbieter ist gerade nicht erreichbar. Die E-Mail wird automatisch erneut versendet.");
      onSent?.();
      onClose();
    } catch {
      setError("Der Server ist derzeit nicht erreichbar. Bitte versuchen Sie es erneut.");
    } finally {
      setSending(false);
    }
  }

  const title = target.type === "reminder" ? `${target.level}. Mahnung versenden` : TITLES[target.type === "order" ? target.kind : target.type];
  return (
    <Dialog open onClose={sending ? undefined : onClose} maxWidth="md" fullWidth aria-labelledby="email-dialog-title">
      <DialogTitle id="email-dialog-title">{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1}>
          {error && <Alert severity="error" role="alert">{error}</Alert>}
          {isPair && partners && partners.length > 0 && (
            <TextField select label="Zweites Angebot" value={partner ?? ""} disabled={sending} onChange={(event) => setPartner(Number(event.target.value))}
              helperText="Ein Wechsel lädt den Entwurf neu; eigene Textänderungen gehen dabei verloren.">
              {partners.map((item) => <MenuItem key={item.orderNumber} value={item.orderNumber}>{familyLabel(item)}</MenuItem>)}
            </TextField>
          )}
          {!draft && !error && <Stack sx={{ py: 4, alignItems: "center" }}><CircularProgress aria-label="Entwurf wird geladen" /></Stack>}
          {draft && <>
            <TextField label="Empfänger" type="email" required value={to} disabled={sending} onChange={(event) => setTo(event.target.value)} />
            <TextField label="Betreff" required value={subject} disabled={sending} onChange={(event) => setSubject(event.target.value)} />
            {draft.attachmentNames.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }} aria-label="Anhänge">
                {draft.attachmentNames.map((name) => <Chip key={name} label={name} size="small" variant="outlined" />)}
              </Stack>
            )}
            <RichTextEditor key={draft.subject + draft.contentHtml} initialHtml={draft.contentHtml} disabled={sending} onChange={setHtml} />
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>Abbrechen</Button>
        <Button variant="contained" onClick={() => void send()} disabled={!draft || sending || !to.trim() || !subject.trim()}>
          {sending ? "Wird gesendet …" : "Senden"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RichTextEditor({ initialHtml, disabled, onChange }: { initialHtml: string; disabled: boolean; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      // Only nodes the server sanitizer keeps; everything else would be stripped on send.
      StarterKit.configure({ blockquote: false, code: false, codeBlock: false, horizontalRule: false, strike: false, heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      Table, TableRow, TableHeader, TableCell,
    ],
    content: initialHtml,
    editable: !disabled,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });
  // Report Tiptap's normalized HTML so the sent text matches what is shown.
  useEffect(() => { if (editor) onChange(editor.getHTML()); }, [editor, onChange]);
  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
    }),
  });
  if (!editor) return null;
  const tools = [
    { label: "Fett", icon: <FormatBold fontSize="small" />, active: active?.bold ?? false, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Kursiv", icon: <FormatItalic fontSize="small" />, active: active?.italic ?? false, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Unterstrichen", icon: <FormatUnderlined fontSize="small" />, active: active?.underline ?? false, run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Aufzählung", icon: <FormatListBulleted fontSize="small" />, active: active?.bulletList ?? false, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Nummerierung", icon: <FormatListNumbered fontSize="small" />, active: active?.orderedList ?? false, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Rückgängig", icon: <Undo fontSize="small" />, active: false, run: () => editor.chain().focus().undo().run() },
    { label: "Wiederholen", icon: <Redo fontSize="small" />, active: false, run: () => editor.chain().focus().redo().run() },
  ];
  return (
    <Paper variant="outlined">
      <Stack direction="row" spacing={0.5} sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
        {tools.map((tool) => (
          <Tooltip key={tool.label} title={tool.label}>
            <span><IconButton size="small" aria-label={tool.label} aria-pressed={tool.active} color={tool.active ? "primary" : "default"} disabled={disabled} onClick={tool.run}>{tool.icon}</IconButton></span>
          </Tooltip>
        ))}
      </Stack>
      <Box sx={{
        px: 2, minHeight: 240, maxHeight: "55vh", overflowY: "auto",
        "& .tiptap": { outline: "none", minHeight: 240 },
        "& table": { borderCollapse: "collapse", my: 1 },
        "& td, & th": { border: 1, borderColor: "divider", px: 1, py: 0.5, verticalAlign: "top" },
        "& td p, & th p": { m: 0 },
      }}>
        <EditorContent editor={editor} aria-label="E-Mail-Text" />
      </Box>
    </Paper>
  );
}

function errorText(reason: unknown): string {
  return reason instanceof Error && !(reason instanceof TypeError) ? reason.message : "Der Server ist derzeit nicht erreichbar. Bitte versuchen Sie es erneut.";
}
