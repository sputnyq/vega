import type { StaffEmailSendResult } from "@vega/domain";

export type EmailAttemptStatus = "UNCONFIRMED" | StaffEmailSendResult["status"];
interface StoredAttempt { key: string; status: EmailAttemptStatus }
const memory = new Map<string, StoredAttempt>();
const statuses: EmailAttemptStatus[] = ["UNCONFIRMED", "SENT", "SENDING", "UNKNOWN", "FAILED", "RETRY_SCHEDULED", "NOT_QUEUED"];

/** Keeps only the key/state in session storage, never recipients or mail text. */
export class EmailSendAttempt {
  private attempt: StoredAttempt | undefined;
  private busy = false;
  private firstRequest = false;

  constructor(private readonly scope: string, private readonly storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
    try {
      const stored = JSON.parse(storage?.getItem(scope) ?? "null") as StoredAttempt | null;
      if (stored && typeof stored.key === "string" && /^[A-Za-z0-9-]{16,100}$/u.test(stored.key) && statuses.includes(stored.status)) this.attempt = stored;
    } catch { /* Storage may be unavailable; the in-memory key still survives dialog remounts. */ }
    this.attempt ??= memory.get(scope);
  }

  get status(): EmailAttemptStatus | undefined { return this.attempt?.status; }
  get frozen(): boolean { return !!this.attempt && !["FAILED", "SENT", "NOT_QUEUED"].includes(this.attempt.status); }

  begin(payload: Record<string, unknown>): Record<string, unknown> | undefined {
    if (this.busy || this.attempt) return undefined;
    this.busy = true;
    this.firstRequest = true;
    this.attempt = { key: crypto.randomUUID(), status: "UNCONFIRMED" };
    this.persist();
    return { ...payload, idempotencyKey: this.attempt.key };
  }

  beginStatusCheck(): { idempotencyKey: string } | undefined {
    if (this.busy || !this.attempt || !this.frozen) return undefined;
    this.busy = true;
    this.firstRequest = false;
    return { idempotencyKey: this.attempt.key };
  }

  finish(result?: StaffEmailSendResult): void {
    this.busy = false;
    if (this.attempt && result) this.attempt.status = result.status;
    this.persist();
  }

  rejectBeforeQueue(errorCode: string): StaffEmailSendResult | undefined {
    // A refusal of a later status check says nothing about the earlier send.
    if (!this.busy || !this.firstRequest) return undefined;
    const result: StaffEmailSendResult = { status: "FAILED", errorCode };
    this.finish(result);
    return result;
  }

  newMessage(): void {
    if (this.busy || (this.status !== "FAILED" && this.status !== "SENT" && this.status !== "NOT_QUEUED")) return;
    this.attempt = undefined;
    memory.delete(this.scope);
    try { this.storage?.removeItem(this.scope); } catch { /* See constructor. */ }
  }

  private persist(): void {
    if (!this.attempt) return;
    memory.set(this.scope, { ...this.attempt });
    try { this.storage?.setItem(this.scope, JSON.stringify(this.attempt)); } catch { /* See constructor. */ }
  }
}

export function mailAttemptStorage(): Storage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}
