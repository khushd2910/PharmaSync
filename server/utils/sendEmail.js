const nodemailer = require('nodemailer');

let cachedTestTransporter = null;

// Lazily creates (and caches) a free Ethereal test-SMTP account. Mail sent
// through it is real SMTP traffic but only lands in a web-based fake inbox
// (never a real address) — used purely as a zero-config fallback so the
// forgot-password/verification flow is testable before real SMTP is set up.
const getTestTransporter = async () => {
  if (cachedTestTransporter) return cachedTestTransporter;
  const testAccount = await nodemailer.createTestAccount();
  cachedTestTransporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return cachedTestTransporter;
};

const buildTransporter = () => {
  const { SMTP_SERVICE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  // Simplest option for common providers (Gmail, Outlook, Yahoo, etc.) —
  // set SMTP_SERVICE=gmail and use an App Password as SMTP_PASS.
  if (SMTP_SERVICE && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      service: SMTP_SERVICE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  // Explicit host/port for any other SMTP provider (SendGrid, Mailgun, a
  // company mail server, etc.)
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return null; // caller falls back to the Ethereal test transporter
};

/**
 * Sends an email via real SMTP if configured; otherwise falls back to a
 * free Ethereal test inbox so the flow can be verified end-to-end (a
 * clickable preview link is logged to the server console) without needing
 * real mail credentials.
 *
 * Never throws — a broken mail provider should not break registration,
 * login, or password-reset requests. Failures are logged and swallowed.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    let transporter = buildTransporter();
    let usingFallback = false;

    if (!transporter) {
      usingFallback = true;
      transporter = await getTestTransporter();
    }

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@pharma-management.local',
      to,
      subject,
      html,
      text,
    });

    if (usingFallback) {
      console.log('\n⚠️  No SMTP configured — sent via Ethereal test inbox (NOT a real mailbox).');
      console.log(`📧 Open this link to view the email: ${nodemailer.getTestMessageUrl(info)}\n`);
    } else {
      console.log(`📧 Email sent to ${to}: "${subject}"`);
    }

    return info;
  } catch (err) {
    console.error(`📧 Failed to send email to ${to}:`, err.message);
    return null;
  }
};

module.exports = sendEmail;
