// Abstract email dispatch. Phase 1 logs to the server console; Phase 2 adds a
// Resend (or SMTP) provider selected via EMAIL_PROVIDER without touching callers.

export async function sendEmail({ to, subject, text }) {
  const provider = process.env.EMAIL_PROVIDER || "console";

  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("EMAIL_PROVIDER=resend but RESEND_API_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "xPortal <xportal@theedgex.com>", to, subject, text }),
    });
    if (!res.ok) throw new Error(`Resend dispatch failed: ${res.status}`);
    return;
  }

  console.log(`\n━━━ [xPortal mail → ${to}] ━━━\n${subject}\n\n${text}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}
