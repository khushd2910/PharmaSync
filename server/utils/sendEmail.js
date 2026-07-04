const nodemailer = require('nodemailer');

/**
 * Sends an email via SMTP if credentials are configured in .env.
 * If not configured (e.g. local development without a mail provider),
 * falls back to logging the email content to the console so the flow
 * (verification / password reset) can still be tested end-to-end.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('\n📧 [DEV EMAIL — SMTP not configured, printing instead]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text || html);
    console.log('— end of email —\n');
    return { dev: true };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject,
    html,
    text,
  });
};

module.exports = sendEmail;
