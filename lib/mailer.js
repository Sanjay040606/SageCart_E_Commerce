import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || smtpUser;

let transporter = null;

const canSendEmail = () => Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

const extractEmailAddress = (value) => {
  if (!value) return "";

  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
};

const getNoReplyFrom = () => {
  if (process.env.NO_REPLY_FROM) {
    return process.env.NO_REPLY_FROM;
  }

  const baseAddress = extractEmailAddress(mailFrom);
  return `SageCart No Reply <${baseAddress}>`;
};

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

export const sendEmail = async ({ to, subject, html, text, replyTo, from = getNoReplyFrom() }) => {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.warn("Email skipped because SMTP environment variables are not configured.");
    return { skipped: true };
  }

  await activeTransporter.sendMail({
    from,
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
