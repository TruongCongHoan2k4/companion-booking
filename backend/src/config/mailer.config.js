import nodemailer from 'nodemailer';

export function createMailTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export function getMailFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@companion-booking.local';
}
