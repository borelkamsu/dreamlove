const nodemailer = require('nodemailer');

let transporter = null;

function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    // Without SMTP settings (local dev), print the email instead of sending it
    console.log(`[mail non envoye - SMTP non configure] A: ${to} | ${subject}\n${text}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

async function sendVerificationCode(email, code) {
  const subject = `Dream Love — votre code de vérification : ${code}`;
  const text = `Bienvenue sur Dream Love !\n\nVotre code de vérification est : ${code}\n\nIl est valable 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#2d2d3a">
      <h2 style="color:#85386e;margin-top:0">Bienvenue sur Dream Love</h2>
      <p>Voici votre code de vérification :</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#85386e;text-align:center;background:#f6ecf3;padding:16px;border-radius:12px">${code}</p>
      <p style="font-size:13px;color:#8b8b99">Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
    </div>`;
  await sendMail({ to: email, subject, text, html });
}

module.exports = { sendMail, sendVerificationCode, isMailConfigured };
