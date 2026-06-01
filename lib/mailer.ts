import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  // Don't throw here because some environments (e.g., local dev) may not have SMTP configured.
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendVerificationEmail(to: string, name: string, otp: string) {
  if (!transporter || !SMTP_HOST) {
    console.warn('SMTP not configured, skipping sending email');
    return;
  }

  const html = `
    <p>Hi ${name},</p>
    <p>Your verification code is: <strong>${otp}</strong></p>
    <p>This code will expire in 10 minutes.</p>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: 'Your PharmaManage verification code',
    html,
    text: `Your verification code is: ${otp}`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, otp: string) {
  if (!transporter || !SMTP_HOST) {
    console.warn('SMTP not configured, skipping sending email');
    return;
  }

  const html = `
    <p>Hi ${name},</p>
    <p>Your password reset code is: <strong>${otp}</strong></p>
    <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: 'PharmaManage password reset code',
    html,
    text: `Your password reset code is: ${otp}`,
  });
}

export async function sendTemporaryPasswordEmail(
  to: string,
  name: string,
  role: 'doctor' | 'patient',
  temporaryPassword: string
) {
  if (!transporter || !SMTP_HOST) {
    console.warn('SMTP not configured, skipping sending email');
    return;
  }

  const html = `
    <p>Hi ${name},</p>
    <p>Your PharmaManage ${role} account has been created.</p>
    <p>Your temporary password is: <strong>${temporaryPassword}</strong></p>
    <p>Please sign in and change it after your first login.</p>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: `Your PharmaManage ${role} account`,
    html,
    text: `Your temporary password is: ${temporaryPassword}`,
  });
}

export default transporter;
