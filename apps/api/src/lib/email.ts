import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "./env.js";
import { logger } from "./logger.js";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Emails "sent" with EMAIL_TRANSPORT=memory (tests read this). */
export const outbox: Email[] = [];

let ses: SESv2Client | undefined;

const parseFrom = (from: string) => {
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { Name: m[1].trim(), Email: m[2].trim() } : { Name: "", Email: from.trim() };
};

/**
 * One way out for every email. On AWS this is Amazon SES (the task role may send from the freshshare.de
 * identity); locally `EMAIL_TRANSPORT=smtp` hands the message to Mailpit (http://localhost:8025) through its
 * send API, so nothing leaves the machine. Failures are logged and never break the request that caused them.
 */
export async function sendEmail(mail: Email): Promise<boolean> {
  try {
    switch (env.EMAIL_TRANSPORT) {
      case "ses": {
        ses ??= new SESv2Client({ region: env.AWS_REGION });
        await ses.send(
          new SendEmailCommand({
            FromEmailAddress: env.EMAIL_FROM,
            Destination: { ToAddresses: [mail.to] },
            Content: {
              Simple: {
                Subject: { Data: mail.subject, Charset: "UTF-8" },
                Body: { Text: { Data: mail.text, Charset: "UTF-8" }, Html: { Data: mail.html, Charset: "UTF-8" } },
              },
            },
          }),
        );
        break;
      }
      case "smtp": {
        const res = await fetch(`${env.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ From: parseFrom(env.EMAIL_FROM), To: [{ Email: mail.to }], Subject: mail.subject, Text: mail.text, HTML: mail.html }),
        });
        if (!res.ok) throw new Error(`Mailpit answered ${res.status}`);
        break;
      }
      case "memory":
        outbox.push(mail);
        break;
      case "log":
        logger.info({ to: mail.to.replace(/^(.).*@/, "$1***@"), subject: mail.subject }, "email (log transport, not sent)");
        break;
      case "off":
        return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, subject: mail.subject }, "email failed");
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A small branded email: headline, one paragraph, one button, and how to switch these emails off. */
export function renderEmail(o: { title: string; body: string; link?: string | null; cta?: string }) {
  const base = (env.APP_URL ?? "https://freshshare.de").replace(/\/$/, "");
  const url = o.link ? `${base}${o.link}` : base;
  const settings = `${base}/profile`;
  const text = `${o.title}\n\n${o.body}\n\n${o.cta ?? "Open FreshShare"}: ${url}\n\nYou get this because email notifications are on. Turn them off in your profile: ${settings}\n`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#2e5e4e;padding:18px 24px;font-size:20px;font-weight:bold;color:#ffffff">Fresh<span style="color:#d9a23c">Share</span></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:20px">${esc(o.title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#44403c">${esc(o.body)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#2e5e4e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(o.cta ?? "Open FreshShare")}</a>
</td></tr>
<tr><td style="padding:0 24px 24px;font-size:12px;color:#78716c">You get this because email notifications are on. <a href="${esc(settings)}" style="color:#2e5e4e">Turn them off in your profile</a>.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}
