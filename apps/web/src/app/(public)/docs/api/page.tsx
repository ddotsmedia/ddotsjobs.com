import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Jobs API — ddotsjobs.com',
  description: 'Post jobs to ddotsjobs.com programmatically over a REST API with token authentication.',
};

const BASE = 'https://ddotsjobs.com/api/v1';

const createExample = `curl -X POST ${BASE}/jobs \\
  -H "Authorization: Bearer ddj_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Staff Nurse",
    "description": "ICU staff nurse, 2+ years experience.",
    "category": "nursing",
    "district": "ernakulam",
    "jobType": "full_time",
    "salaryMin": 25000,
    "salaryMax": 35000
  }'`;

const createResp = `{ "jobId": "…", "status": "pending_review", "url": "https://ddotsjobs.com/jobs/staff-nurse-ernakulam-ab12cd" }`;

const listExample = `curl ${BASE}/jobs -H "Authorization: Bearer ddj_live_xxxxxxxx"`;
const meExample = `curl ${BASE}/me -H "Authorization: Bearer ddj_live_xxxxxxxx"`;
const updateExample = `curl -X PUT ${BASE}/jobs/JOB_ID \\
  -H "Authorization: Bearer ddj_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "salaryMax": 40000 }'`;
const deleteExample = `curl -X DELETE ${BASE}/jobs/JOB_ID -H "Authorization: Bearer ddj_live_xxxxxxxx"`;

const ENDPOINTS = [
  { m: 'POST', p: '/jobs', d: 'Create a job. Returns { jobId, status, url }.' },
  { m: 'GET', p: '/jobs', d: 'List your jobs.' },
  { m: 'PUT', p: '/jobs/{jobId}', d: 'Update a job (title, description, salary, validThrough).' },
  { m: 'DELETE', p: '/jobs/{jobId}', d: 'Soft-delete (close) a job.' },
  { m: 'GET', p: '/me', d: 'Authenticated employer + posting quota.' },
];

const ERRORS = [
  ['401', 'unauthorized', 'Missing or invalid API key.'],
  ['403', 'forbidden', 'Job post limit reached for the period.'],
  ['404', 'not_found', 'Job not found / not yours.'],
  ['422', 'validation_error', 'Body failed validation (message names the field).'],
  ['429', 'rate_limited', '100 posts/day or 1000 requests/day exceeded.'],
];

export default function ApiDocsPage() {
  return (
    <main style={s.page}>
      <div style={s.wrap}>
        <p style={s.eyebrow}>Developers</p>
        <h1 style={s.h1}>Jobs API</h1>
        <p style={s.lead}>Post and manage jobs on ddotsjobs.com programmatically. Base URL <code style={s.ic}>{BASE}</code>.</p>

        <h2 style={s.h2}>Authentication</h2>
        <p style={s.p}>Create a key under <strong>Employer → API Keys</strong>. Send it as a bearer token on every request:</p>
        <pre style={s.pre}>{`Authorization: Bearer ddj_live_xxxxxxxx`}</pre>
        <p style={s.note}>The key is shown once at creation — store it securely. Keys are scoped to your employer account.</p>

        <h2 style={s.h2}>Endpoints</h2>
        <div style={s.table}>
          {ENDPOINTS.map((e) => (
            <div key={e.m + e.p} style={s.row}>
              <span style={{ ...s.method, ...methodColor(e.m) }}>{e.m}</span>
              <code style={s.path}>{e.p}</code>
              <span style={s.desc}>{e.d}</span>
            </div>
          ))}
        </div>

        <h2 style={s.h2}>Create a job</h2>
        <p style={s.p}>Required: <code style={s.ic}>title, description, category, district, salaryMin, salaryMax</code>. Salaries are whole rupees/month. Description ≤ 5000 chars.</p>
        <pre style={s.pre}>{createExample}</pre>
        <p style={s.p}>Response:</p>
        <pre style={s.pre}>{createResp}</pre>

        <h2 style={s.h2}>Other examples</h2>
        <pre style={s.pre}>{listExample}</pre>
        <pre style={s.pre}>{updateExample}</pre>
        <pre style={s.pre}>{deleteExample}</pre>
        <pre style={s.pre}>{meExample}</pre>

        <h2 style={s.h2}>Rate limits</h2>
        <ul style={s.ul}>
          <li>100 job creates per API key per day.</li>
          <li>1000 total requests per API key per day.</li>
        </ul>

        <h2 style={s.h2}>Errors</h2>
        <p style={s.p}>Errors return JSON: <code style={s.ic}>{`{ "error": { "code": "…", "message": "…" } }`}</code></p>
        <div style={s.table}>
          {ERRORS.map((e) => (
            <div key={e[0]} style={s.row}>
              <span style={s.status}>{e[0]}</span>
              <code style={s.path}>{e[1]}</code>
              <span style={s.desc}>{e[2]}</span>
            </div>
          ))}
        </div>
        <p style={s.note}>Webhooks (job status changes) are planned — not available yet.</p>
      </div>
    </main>
  );
}

function methodColor(m: string): React.CSSProperties {
  if (m === 'POST') return { background: '#e6f5ea', color: '#1d7a3a' };
  if (m === 'PUT') return { background: '#fdf3da', color: '#9a6b00' };
  if (m === 'DELETE') return { background: '#fdecea', color: '#c0392b' };
  return { background: '#eef6f5', color: '#1f6b70' };
}

const s: Record<string, React.CSSProperties> = {
  page: { background: 'var(--color-neutral)', minHeight: '100dvh', paddingBottom: 'var(--space-5)' },
  wrap: { width: '100%', maxWidth: 760, margin: '0 auto', padding: 'var(--space-3) var(--space-2)' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent)', margin: 0 },
  h1: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(1.9rem,6vw,2.6rem)', margin: '2px 0 0', color: 'var(--color-dark)' },
  lead: { fontSize: 15, color: '#55554f', margin: '8px 0 var(--space-2)', lineHeight: 1.5 },
  h2: { fontSize: 18, fontWeight: 700, color: 'var(--color-dark)', margin: 'var(--space-3) 0 8px' },
  p: { fontSize: 14, color: '#3a3a34', lineHeight: 1.6, margin: '0 0 10px' },
  note: { fontSize: 13, color: '#8a8a83', margin: '8px 0 0' },
  ic: { background: '#f1f1ec', borderRadius: 4, padding: '1px 6px', fontSize: 13 },
  pre: { background: '#0F1A1B', color: '#e8e8e2', borderRadius: 10, padding: 'var(--space-2)', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.5, margin: '0 0 12px' },
  table: { display: 'flex', flexDirection: 'column', gap: 2, background: '#fff', border: '1px solid #efefe9', borderRadius: 'var(--radius-card)', padding: 8, marginBottom: 12 },
  row: { display: 'flex', gap: 10, alignItems: 'center', padding: '8px 6px', flexWrap: 'wrap' },
  method: { fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, minWidth: 54, textAlign: 'center' },
  status: { fontSize: 12, fontWeight: 700, color: '#c0392b', minWidth: 40 },
  path: { fontSize: 13, color: '#1a1916', fontWeight: 600 },
  desc: { fontSize: 13, color: '#6b6b66', flex: 1, minWidth: 160 },
  ul: { margin: '0 0 12px', paddingLeft: 20, fontSize: 14, color: '#3a3a34', lineHeight: 1.7 },
};
