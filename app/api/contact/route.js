import { NextResponse } from "next/server";
import { buildContactEmail } from "@/lib/emailTemplates";
import { getContactReceiver, sendEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const { name, email, phone, subject, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ success: false, message: "Missing required fields." }, { status: 400 });
    }

    const contactEmail = buildContactEmail({ name, email, phone, subject, message });

    await sendEmail({
      to: getContactReceiver(),
      subject: contactEmail.subject,
      html: contactEmail.html,
      text: contactEmail.text,
      replyTo: email,
    });

    return NextResponse.json({ success: true, message: "Message sent successfully." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
