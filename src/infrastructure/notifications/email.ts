// Resend email adapter per ARD §3.6
// Gracefully degrades when RESEND_API_KEY is not set.

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.log("[email] not configured — would send to:", to, subject);
    return false;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const from = process.env["EMAIL_FROM"] ?? "noreply@condominiolegal.com.br";
    await resend.emails.send({ from, to, subject, html });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}
