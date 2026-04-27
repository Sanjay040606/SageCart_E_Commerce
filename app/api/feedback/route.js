import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildFeedbackEmail } from "@/lib/emailTemplates";
import { getContactReceiver, sendEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, message: "Please sign in to send feedback." }, { status: 401 });
    }

    const { subject, message, page } = await request.json();
    const trimmedSubject = subject?.trim();
    const trimmedMessage = message?.trim();

    if (!trimmedMessage) {
      return NextResponse.json({ success: false, message: "Please write your feedback before sending." }, { status: 400 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser?.primaryEmailAddress?.emailAddress
      || clerkUser?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return NextResponse.json({ success: false, message: "Could not find an email address for this account." }, { status: 400 });
    }

    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
      || clerkUser.username
      || "SageCart user";

    const feedbackEmail = buildFeedbackEmail({
      name,
      email,
      page,
      subject: trimmedSubject,
      message: trimmedMessage,
    });

    await sendEmail({
      to: getContactReceiver(),
      subject: feedbackEmail.subject,
      html: feedbackEmail.html,
      text: feedbackEmail.text,
      replyTo: email,
    });

    return NextResponse.json({ success: true, message: "Feedback sent successfully." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
