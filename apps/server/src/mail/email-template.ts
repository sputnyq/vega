/**
 * The established Umzug Ruck Zuck mail frame.  Keep this server-side: callers
 * only provide the editable inner body, never a complete document.
 */
const EMAIL_LAYOUT = `<!doctype html>
<html lang="de-DE"><head><meta charset="UTF-8" /><meta name="x-apple-disable-message-reformatting" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Umzug Ruck Zuck</title><style>
body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #333333; font-size: 1rem; }
p { margin-block-start: 0.6rem; margin-block-end: 0.6rem; } table { width: 100%; } td { padding: 0.2rem; border: 0; } table tr:last-child { border-top: 1px solid #333; }
.image-container { text-align: center; padding: 10px; } .image { max-width: 100%; height: auto; } .container { max-width: 700px; margin: 0 auto; background: #ececed3b; } .content, .footer { padding: 0.8rem; }
.footer { color: #a8a8a8; background-color: #363636; font-size: 0.8rem; } .footer a { color: #a8a8a8; } .footer a:hover { color: #ffffff; } .rating { color: #ea5b27; } .centered { text-align: center; }
.ql-align-right { text-align: right; } .ql-align-center { text-align: center; }
</style></head><body><div class="container"><div class="image-container"><img class="image" alt="Umzug Ruck Zuck" src="https://umzugruckzuck24.de/wp-content/uploads/2026/06/Logo-147.svg" /></div><div class="content">{{content}}<br /><p>Freundliche Grüße, <br />Ihr Umzug Ruck Zuck Team.</p></div><div class="footer"><p class="centered">Mobil: 0176 101 719 90</p><p class="centered">Telefon: 089 306 429 72</p><p class="centered"><a href="https://umzugruckzuck24.de">umzugruckzuck24.de</a></p><p class="centered">© Umzug Ruck Zuck. Alle Rechte vorbehalten.</p></div></div></body></html>`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export function renderEmailLayout(contentHtml: string): string {
  return EMAIL_LAYOUT.replace("{{content}}", sanitizeEmailHtml(contentHtml));
}

/**
 * Text comes from a rich-text editor, not from a trusted template file. Keep a
 * deliberately small formatting subset and reject executable/event attributes
 * and non-web links before it reaches an HTML email.
 */
export function sanitizeEmailHtml(html: string): string {
  const allowedTags = new Set(["a", "b", "br", "div", "em", "h1", "h2", "h3", "i", "li", "ol", "p", "span", "strong", "table", "tbody", "td", "thead", "tr", "u", "ul"]);
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*\/?\s*(?:script|style|iframe|object|embed|form|input)[^>]*>/gi, "")
    .replace(/<\s*\/??\s*([a-z0-9]+)([^>]*)>/gi, (whole, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag)) return "";
      if (/^<\s*\//.test(whole)) return `</${tag}>`;
      if (tag !== "a") return `<${tag}>`;
      const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(rawAttributes)?.[2]?.trim();
      if (!href || !/^(https?:|mailto:)/i.test(href)) return "<a>";
      const decodedHref = href.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
      return `<a href="${escapeHtml(decodedHref)}">`;
    });
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function passwordResetEmail(url: string): { subject: string; contentHtml: string; text: string } {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Passwort zurücksetzen",
    text: `Sie haben angefordert, Ihr Passwort zurückzusetzen.\n\nPasswort zurücksetzen: ${url}\n\nFalls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.`,
    contentHtml: `<p>Sie haben angefordert, Ihr Passwort zurückzusetzen.</p><p><a href="${safeUrl}">Passwort zurücksetzen</a></p><p>Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>`,
  };
}

export const emailDefaults = {
  inquiryNotification(customerName: string, orderNumber: number) {
    return {
      subject: `Neue Umzugsanfrage ${orderNumber}`,
      contentHtml: `<p>Eine neue Umzugsanfrage von ${escapeHtml(customerName)} wurde gespeichert.</p><p>Auftragsnummer: ${orderNumber}. Bitte prüfen Sie die vollständigen Angaben in der Vega-Admin-Oberfläche.</p>`,
    };
  },
  inquiryReceived(customerName: string, orderNumber: number) {
    return {
      subject: `Wir haben Ihre Umzugsanfrage ${orderNumber} erhalten`,
      contentHtml: `<p>Guten Tag ${escapeHtml(customerName)},</p><p>vielen Dank für Ihre Anfrage. Wir haben diese erhalten und melden uns schnellstmöglich bei Ihnen.</p>`,
    };
  },
  offer(orderNumber: number) {
    return {
      subject: `📦 Umzugsangebot zu Ihrer Anfrage ${orderNumber}`,
      contentHtml: "<p>Vielen Dank für Ihre Anfrage. Im Anhang finden Sie unser Umzugsangebot.</p><p>Wir freuen uns auf Ihre Rückmeldung.</p>",
    };
  },
  invoice(invoiceNumber: string) {
    return {
      subject: `Rechnung zu Ihrem Umzug ${invoiceNumber}`,
      contentHtml: "<p>Vielen Dank, dass Sie unsere Leistungen in Anspruch genommen haben.</p><p>Im Anhang befindet sich Ihre Rechnung.</p>",
    };
  },
  inquiryDeclined(orderNumber: number) {
    return {
      subject: `Ihre Umzugsanfrage ${orderNumber}`,
      contentHtml: "<p>Wir bedauern sehr, Ihnen mitteilen zu müssen, dass wir derzeit leider keine Kapazitäten haben, um Ihren Umzug übernehmen zu können. Daher können wir Ihnen momentan kein Angebot unterbreiten. Wir wünschen Ihnen viel Erfolg bei der weiteren Suche nach einem passenden Umzugsunternehmen.</p>",
    };
  },
};
