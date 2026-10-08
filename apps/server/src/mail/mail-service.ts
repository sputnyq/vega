import { htmlToPlainText, passwordResetEmail, renderEmailLayout } from "./email-template.js";
import type { MailAttachment, OutgoingMail } from "./hostinger-mail-client.js";

export type EmailKind = "INQUIRY_RECEIVED" | "OFFER" | "INVOICE" | "INQUIRY_DECLINED" | "PASSWORD_RESET";

export interface SendMailInput {
  kind: EmailKind;
  to: string[];
  subject: string;
  contentHtml: string;
  attachments?: MailAttachment[];
  displayName?: string;
}

export interface MailTransport {
  send(message: OutgoingMail): Promise<void>;
}

export class MailService {
  constructor(private readonly transport: MailTransport) {}

  async send(input: SendMailInput): Promise<void> {
    const recipients = [...new Set(input.to.map((address) => address.trim().toLowerCase()))];
    if (!recipients.length || recipients.some((address) => !isEmail(address))) {
      throw new Error("INVALID_EMAIL_RECIPIENT");
    }
    if (!input.subject.trim() || input.subject.length > 998 || !input.contentHtml.trim()) {
      throw new Error("INVALID_EMAIL_CONTENT");
    }
    const message: OutgoingMail = {
      to: recipients,
      subject: input.subject.trim(),
      html: renderEmailLayout(input.contentHtml),
      text: htmlToPlainText(input.contentHtml),
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.attachments ? { attachments: input.attachments } : {}),
    };
    await this.transport.send(message);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const draft = passwordResetEmail(resetUrl);
    await this.send({ kind: "PASSWORD_RESET", to: [to], ...draft });
  }
}

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}
