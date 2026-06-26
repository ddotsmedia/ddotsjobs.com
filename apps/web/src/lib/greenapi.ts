// WhatsApp OTP delivery via Green API. Phone OTP must go over a phone channel —
// Resend (email) cannot reach a phone number. Green API credentials live in
// GREEN_API_INSTANCE_ID / GREEN_API_TOKEN; the API host is account-specific and
// overridable via GREEN_API_BASE_URL.
const BASE_URL = process.env.GREEN_API_BASE_URL ?? 'https://api.green-api.com';

/** +919876543210 -> 919876543210@c.us (Green API chat id). */
function toChatId(phone: string): string {
  return `${phone.replace(/[^\d]/g, '')}@c.us`;
}

export async function sendWhatsAppOtp(phone: string, code: string): Promise<void> {
  const id = process.env.GREEN_API_INSTANCE_ID;
  const token = process.env.GREEN_API_TOKEN;
  if (!id || !token) throw new Error('GREEN_API_INSTANCE_ID / GREEN_API_TOKEN not set');

  const url = `${BASE_URL}/waInstance${id}/sendMessage/${token}`;
  const message = `Your ddotsjobs.com OTP is ${code}. Valid 10 minutes.`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chatId: toChatId(phone), message }),
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') throw err;
    console.warn(`[otp] WhatsApp send failed (${String(err)}); dev code for ${phone}: ${code}`);
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Green API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { idMessage?: string };
  if (!data.idMessage) throw new Error('Green API: send accepted but no idMessage returned');
}
