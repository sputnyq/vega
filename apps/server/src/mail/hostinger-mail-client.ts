import type { HostingerMailConfig } from "../config.js";

export interface MailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  cid?: string;
}

export interface OutgoingMail {
  to: string[];
  subject: string;
  html: string;
  text: string;
  displayName?: string;
  expectedFromAddress?: string;
  attachments?: MailAttachment[];
}

export class MailDeliveryError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly status?: number) {
    super(code);
    this.name = "MailDeliveryError";
  }
}

export class HostingerMailClient {
  constructor(
    private readonly config: HostingerMailConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async send(message: OutgoingMail): Promise<void> {
    const endpoint = new URL(`/api/v1/mailboxes/${encodeURIComponent(this.config.mailboxResourceId)}/send`, this.config.apiBaseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      if (message.expectedFromAddress) {
        const accountResponse = await this.fetchImpl(new URL("/api/v1/me", this.config.apiBaseUrl), {
          headers: { Authorization: `Bearer ${this.config.apiToken}`, Accept: "application/json" },
          signal: controller.signal,
        });
        if (!accountResponse.ok) throw new MailDeliveryError(await responseCode(accountResponse), accountResponse.status === 429 || accountResponse.status >= 500, accountResponse.status);
        const account = await accountResponse.json() as { data?: { mailboxes?: Array<{ resourceId: string; address: string }> } };
        const mailbox = account.data?.mailboxes?.find((item) => item.resourceId === this.config.mailboxResourceId);
        if (!mailbox || mailbox.address.toLowerCase() !== message.expectedFromAddress.toLowerCase()) {
          throw new MailDeliveryError("MAIL_SENDER_ADDRESS_MISMATCH", false);
        }
      }
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.displayName ? { displayName: message.displayName } : {}),
          ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        }),
        signal: controller.signal,
      });
      // Per Hostinger OpenAPI, successful send is explicitly 204 with no body.
      if (response.status === 204) return;
      const code = await responseCode(response);
      throw new MailDeliveryError(code, response.status === 429 || response.status >= 500, response.status);
    } catch (error) {
      if (error instanceof MailDeliveryError) throw error;
      throw new MailDeliveryError(error instanceof DOMException && error.name === "AbortError" ? "MAIL_TIMEOUT" : "MAIL_NETWORK_ERROR", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function responseCode(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: { code?: unknown }; code?: unknown };
    const code = body.error?.code ?? body.code;
    if (typeof code === "string" && /^[A-Z0-9_]{1,100}$/.test(code)) return code;
  } catch {
    // Error bodies are intentionally not logged or retained; they can contain mail details.
  }
  return `HOSTINGER_HTTP_${response.status}`;
}
