import { Resend } from 'resend';

// OTP delivery via Resend. Per A2 spec the recipient ID is the phone number and
// the body is plain text. SMS/WhatsApp (Green API) becomes the production
// delivery channel in a later phase; this keeps the A2 contract.
const OTP_FROM = process.env.OTP_FROM ?? 'ddotsjobs <noreply@ddotsjobs.com>';

let _resend: Resend | null = null;
function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend ??= new Resend(key);
  return _resend;
}

export async function sendOtp(phone: string, code: string): Promise<void> {
  const text = `Your ddotsjobs.com OTP is ${code}. Valid 10 minutes.`;
  try {
    const { error } = await client().emails.send({
      from: OTP_FROM,
      to: phone,
      subject: 'ddotsjobs.com OTP',
      text,
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    // In non-production, surface the code to the server log so the flow is
    // testable without a deliverable channel. In production, fail loudly.
    if (process.env.NODE_ENV === 'production') throw err;
    console.warn(`[otp] delivery failed (${String(err)}); dev code for ${phone}: ${code}`);
  }
}
