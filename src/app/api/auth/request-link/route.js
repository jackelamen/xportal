import { NextResponse } from "next/server";
import { findUserByEmail, createLoginToken } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";

export async function POST(request) {
  const { email, kind } = await request.json().catch(() => ({}));
  const userType = kind === "operator" ? "operator" : "client";
  // Always 200 with the same body so the endpoint can't be used to enumerate users.
  if (typeof email === "string") {
    const user = findUserByEmail(userType, email);
    if (user) {
      const token = createLoginToken(userType, user.id);
      const url = `${process.env.APP_BASE_URL || "http://localhost:3100"}/auth/verify?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: "Your xPortal sign-in link",
        text: `Hi ${user.name},\n\nSign in here (expires in 15 minutes):\n${url}`,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
