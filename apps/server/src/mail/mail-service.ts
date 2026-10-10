import { htmlToPlainText, passwordResetEmail, renderEmailLayout } from "./email-template.js";
import type { MailAttachment, OutgoingMail } from "./hostinger-mail-client.js";
import type { AppSettingsDto } from "@vega/domain";
import { isValidEmailAddress } from "@vega/domain";

export type EmailKind = "INQUIRY_RECEIVED" | "OFFER" | "INVOICE" | "INQUIRY_DECLINED" | "PASSWORD_RESET";

export interface SendMailInput {
  kind: EmailKind;
  to: string[];
  subject: string;
  contentHtml: string;
  text?: string;
  attachments?: MailAttachment[];
  displayName?: string;
}

export interface MailTransport {
  send(message: OutgoingMail): Promise<void>;
}

export class MailService {
  constructor(private readonly transport: MailTransport, private readonly settingsProvider?: () => Promise<AppSettingsDto>) {}

  async send(input: SendMailInput): Promise<void> {
    const recipients = [...new Set(input.to.map((address) => address.trim().toLowerCase()))];
    if (!recipients.length || recipients.some((address) => !isEmail(address))) {
      throw new Error("INVALID_EMAIL_RECIPIENT");
    }
    if (!input.subject.trim() || input.subject.length > 998 || !input.contentHtml.trim()) {
      throw new Error("INVALID_EMAIL_CONTENT");
    }
    const settings = await this.settingsProvider?.();
    const displayName = input.displayName ?? settings?.emailFromName;
    const message: OutgoingMail = {
      to: recipients,
      subject: input.subject.trim(),
      html: renderEmailLayout(input.contentHtml),
      text: input.text ?? htmlToPlainText(input.contentHtml),
      ...(displayName ? { displayName } : {}),
      ...(settings?.emailFromAddress ? { expectedFromAddress: settings.emailFromAddress } : {}),
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
  return isValidEmailAddress(value);
}
