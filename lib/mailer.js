import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter = null;

const canSendEmail = () => Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

const getTransporter = () => {
  if (!canSendEmail()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  return transporter;
};

export const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn("Email skipped because SMTP environment variables are not configured.");
    return { skipped: true };
  }

  await activeTransporter.sendMail({
    from: process.env.MAIL_FROM || smtpUser,
    to,
    subject,
    html,
    text,
    replyTo,
  });

  return { skipped: false };
};

export const getContactReceiver = () =>
  process.env.CONTACT_RECEIVER_EMAIL || "sagecart.support@gmail.com";

export { canSendEmail };
