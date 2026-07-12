import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Webhooks — ddotsjobs.com',
  description: 'Subscribe to job and application events and receive signed, real-time HTTP callbacks at your own endpoint.',
};

const EVENTS = [
  ['job_posted', 'A job you own is published.', '{ "jobId": "…", "title": "Staff Nurse", "url": "https://ddotsjobs.com/jobs/…" }'],
  ['application_received', 'A candidate applies to one of your jobs.', '{ "applicationId": "…", "jobId": "…", "candidateName": "Ann K" }'],
  ['application_stage_changed', 'You move an applicant to a new pipeline stage.', '{ "applicationId": "…", "jobId": "…", "stage": "interview" }'],
  ['offer_sent', 'You send an offer to a candidate.', '{ "applicationId": "…", "jobId": "…", "position": "Staff Nurse", "salary": "₹30,000/mo" }'],
  ['application_rejected', 'You reject an applicant.', '{ "applicationId": "…", "jobId": "…", "reason": "Position filled" }'],
];

const envelope = `{
  "event": "application_received",
  "timestamp": "2026-07-12T09:30:00.000Z",
  "data": {
    "applicationId": "…",
    "jobId": "…",
    "candidateName": "Ann K"
  }
}`;

const headers = `Content-Type: application/json
X-DdotsJobs-Event: application_received
X-Signature: sha256=<hex hmac of the raw request body>`;

const verifyNode = `import { createHmac, timingSafeEqual } from 'node:crypto';

// rawBody: the exact bytes of the request body (do NOT re-serialize the parsed JSON)
function verify(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Express example
app.post('/webhooks/ddotsjobs', express.raw({ type: 'application/json' }), (req, res) => {
  if (!verify(req.body, req.get('X-Signature') || '', process.env.DDOTSJOBS_WEBHOOK_SECRET)) {
    return res.status(401).end();
  }
  const payload = JSON.parse(req.body.toString('utf8'));
  // handle payload.event … respond 2xx quickly
  res.status(200).end();
});`;

export default function WebhookDocsPage() {
  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <p style={s.eyebrow}>Developers</p>
        <h1 style={s.h1}>Webhooks</h1>
        <p style={s.lead}>Subscribe to job and application events and get a signed HTTP POST at your endpoint the moment they happen — no polling.</p>

        <h2 style={s.h2}>Getting started</h2>
        <ol style={s.ol}>
          <li>Go to <strong>Employer → Webhooks</strong> and add an endpoint URL (must be <code style={s.ic}>https://</code>).</li>
          <li>Pick the events you want. Copy the signing secret — it is shown when the webhook is created and after each rotation.</li>
          <li>Verify the <code style={s.ic}>X-Signature</code> header on every request, then return a <code style={s.ic}>2xx</code> status.</li>
        </ol>

        <h2 style={s.h2}>Events</h2>
        <div style={s.table}>
          {EVENTS.map((e) => (
            <div key={e[0]} style={s.row}>
              <code style={s.evtName}>{e[0]}</code>
              <span style={s.desc}>{e[1]}</span>
            </div>
          ))}
        </div>

        <h2 style={s.h2}>Payload</h2>
        <p style={s.p}>Every delivery is a JSON POST with a common envelope. The <code style={s.ic}>data</code> object differs per event.</p>
        <pre style={s.pre}>{envelope}</pre>
        <p style={s.p}>Request headers:</p>
        <pre style={s.pre}>{headers}</pre>

        <h2 style={s.h2}>Per-event data</h2>
        <div style={s.table}>
          {EVENTS.map((e) => (
            <div key={e[0]} style={s.dataRow}>
              <code style={s.evtName}>{e[0]}</code>
              <code style={s.dataShape}>{e[2]}</code>
            </div>
          ))}
        </div>

        <h2 style={s.h2}>Verifying signatures</h2>
        <p style={s.p}>The <code style={s.ic}>X-Signature</code> header is <code style={s.ic}>sha256=</code> followed by the HMAC-SHA256 of the <em>raw</em> request body, keyed with your signing secret. Compare it in constant time and reject mismatches.</p>
        <pre style={s.pre}>{verifyNode}</pre>

        <h2 style={s.h2}>Retries &amp; delivery</h2>
        <ul style={s.ul}>
          <li>A delivery succeeds on any <code style={s.ic}>2xx</code> response. Anything else (or a timeout) is retried.</li>
          <li>Retries use exponential backoff: <code style={s.ic}>1s, 2s, 4s, 8s, 16s</code> — up to 5 retries, then the delivery is marked failed.</li>
          <li>Requests time out after 10 seconds. Respond fast and do heavy work asynchronously.</li>
          <li>Deliveries may arrive out of order and, on rare retries, more than once — make your handler idempotent using <code style={s.ic}>applicationId</code> / <code style={s.ic}>jobId</code>.</li>
        </ul>

        <h2 style={s.h2}>Testing</h2>
        <p style={s.p}>Use <strong>Send test</strong> on the Webhooks page to queue a sample <code style={s.ic}>test</code> delivery, then check the <strong>Logs</strong> panel for status code, retries and timing.</p>

        <h2 style={s.h2}>Security &amp; limits</h2>
        <ul style={s.ul}>
          <li>HTTPS endpoints only.</li>
          <li>Up to 100 webhooks per employer.</li>
          <li>Webhooks only ever fire for events on your own jobs and applicants.</li>
          <li>Rotate the secret anytime — the old secret stops working immediately.</li>
        </ul>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  wrap: { width: '100%', maxWidth: 760, margin: '0 auto', padding: 'var(--space-3) var(--space-2)' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.9rem,6vw,2.6rem)', margin: '2px 0 0', color: 'var(--color-dark)' },
  lead: { fontSize: 15, color: '#55554f', margin: '8px 0 var(--space-2)', lineHeight: 1.5 },
  h2: { fontSize: 18, fontWeight: 700, color: 'var(--color-dark)', margin: 'var(--space-3) 0 8px' },
  p: { fontSize: 14, color: '#3a3a34', lineHeight: 1.6, margin: '0 0 10px' },
  ic: { background: '#f1f1ec', borderRadius: 4, padding: '1px 6px', fontSize: 13 },
  pre: { background: '#0F1A1B', color: '#e8e8e2', borderRadius: 10, padding: 'var(--space-2)', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px', whiteSpace: 'pre' },
  table: { display: 'flex', flexDirection: 'column', gap: 2, background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 8, marginBottom: 12 },
  row: { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 6px', flexWrap: 'wrap' },
  dataRow: { display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 6px', borderBottom: '1px solid #f4f4ef' },
  evtName: { fontSize: 13, color: '#1a1916', fontWeight: 700 },
  dataShape: { fontSize: 12, color: '#55554f', wordBreak: 'break-word' },
  desc: { fontSize: 13, color: '#6b6b66', flex: 1, minWidth: 160 },
  ul: { margin: '0 0 12px', paddingLeft: 20, fontSize: 14, color: '#3a3a34', lineHeight: 1.7 },
  ol: { margin: '0 0 12px', paddingLeft: 20, fontSize: 14, color: '#3a3a34', lineHeight: 1.8 },
};
