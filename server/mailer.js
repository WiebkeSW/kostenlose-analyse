import nodemailer from "nodemailer";
import { bauMail } from "../shared/mailBuilder.js";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_BCC } = process.env;

const konfiguriert = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transport = konfiguriert
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === "true",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

if (!konfiguriert) {
  console.warn(
    "[mailer] Kein SMTP konfiguriert (siehe .env.example) — Antwort-Mails werden nicht automatisch versendet."
  );
}

// Verschickt die Antwort-Mail für eine Submission. Wirft nie — Fehler werden
// zurückgegeben, damit ein Mail-Problem die Submission selbst nicht gefährdet.
export async function sendeAntwortMail(eintrag) {
  if (!transport) {
    return { versendet: false, grund: "SMTP nicht konfiguriert" };
  }
  const empfaenger = eintrag.formular.firma.kontaktEmail;
  if (!empfaenger) {
    return { versendet: false, grund: "Keine Empfänger-Adresse in der Submission" };
  }

  try {
    const { betreff, html, text } = bauMail(eintrag);
    await transport.sendMail({
      from: MAIL_FROM || SMTP_USER,
      to: empfaenger,
      bcc: MAIL_BCC || undefined,
      subject: betreff,
      html,
      text,
    });
    return { versendet: true };
  } catch (fehler) {
    console.error("[mailer] Versand fehlgeschlagen:", fehler.message);
    return { versendet: false, grund: fehler.message };
  }
}
