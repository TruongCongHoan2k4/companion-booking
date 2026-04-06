import { createMailTransport, getMailFrom } from '../config/mailer.config.js';

export async function sendPasswordResetOtpEmail(toEmail, otpCode) {
  const transport = createMailTransport();
  const from = getMailFrom();
  const subject = 'Mã OTP khôi phục mật khẩu — Companion Rental';
  const text = `Mã OTP 6 số của bạn: ${otpCode}\n\nMã có hiệu lực trong ${process.env.OTP_EXPIRE_MINUTES || 15} phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`;

  if (!transport) {
    console.warn(`[EMAIL MOCK] Gửi OTP tới ${toEmail}: ${otpCode}`);
    return { mocked: true };
  }

  await transport.sendMail({
    from,
    to: toEmail,
    subject,
    text,
  });
  return { mocked: false };
}
