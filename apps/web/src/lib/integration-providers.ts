import { z } from 'zod';

// Client-safe provider catalog (no server-only imports) — shared by the router
// and the UI. Connection is credential-based (paste a webhook URL / API token):
// full 3-legged OAuth needs registered provider apps + secrets we don't hold, so
// this is the path that actually works. LinkedIn Jobs API is partner-gated → soon.

export type ProviderName = 'slack' | 'hubspot' | 'linkedin' | 'zapier' | 'airtable';

export interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'url';
  secret?: boolean;
}

export interface ProviderMeta {
  name: ProviderName;
  label: string;
  blurb: string;
  connectable: boolean;
  comingSoon?: boolean;
  helpUrl?: string;
  fields: FieldDef[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    name: 'slack',
    label: 'Slack',
    blurb: 'Post job & applicant alerts to a Slack channel.',
    connectable: true,
    helpUrl: 'https://api.slack.com/messaging/webhooks',
    fields: [{ key: 'webhookUrl', label: 'Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/…', type: 'url', secret: true }],
  },
  {
    name: 'zapier',
    label: 'Zapier',
    blurb: 'Trigger Zaps from ddotsjobs events.',
    connectable: true,
    helpUrl: 'https://zapier.com/apps/webhook/integrations',
    fields: [{ key: 'webhookUrl', label: 'Catch Hook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/…', type: 'url', secret: true }],
  },
  {
    name: 'airtable',
    label: 'Airtable',
    blurb: 'Sync jobs & applications into an Airtable base.',
    connectable: true,
    helpUrl: 'https://airtable.com/create/tokens',
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'pat…', secret: true },
      { key: 'baseId', label: 'Base ID', placeholder: 'app…' },
      { key: 'tableName', label: 'Table name', placeholder: 'Jobs' },
    ],
  },
  {
    name: 'hubspot',
    label: 'HubSpot',
    blurb: 'Create CRM contacts from applicants & offers.',
    connectable: true,
    helpUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    fields: [{ key: 'token', label: 'Private App Token', placeholder: 'pat-na1-…', secret: true }],
  },
  {
    name: 'linkedin',
    label: 'LinkedIn',
    blurb: 'Cross-post jobs to LinkedIn (partner API — coming soon).',
    connectable: false,
    comingSoon: true,
    fields: [],
  },
];

export const PROVIDER_NAMES = PROVIDERS.map((p) => p.name) as [ProviderName, ...ProviderName[]];

export function providerMeta(name: ProviderName): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.name === name);
}

// Per-provider credential validation.
export function providerConfigSchema(name: ProviderName): z.ZodTypeAny | null {
  switch (name) {
    case 'slack':
    case 'zapier':
      return z.object({ webhookUrl: z.string().url().max(500).refine((u) => u.startsWith('https://'), 'HTTPS required') });
    case 'airtable':
      return z.object({ token: z.string().min(10).max(200), baseId: z.string().min(5).max(100), tableName: z.string().min(1).max(100) });
    case 'hubspot':
      return z.object({ token: z.string().min(10).max(200) });
    default:
      return null;
  }
}

// Non-secret display hints stored in integrations.meta.
export function maskMeta(name: ProviderName, config: Record<string, unknown>): Record<string, unknown> {
  if (name === 'slack' || name === 'zapier') {
    try {
      return { host: new URL(String(config.webhookUrl)).host };
    } catch {
      return {};
    }
  }
  if (name === 'airtable') return { baseId: config.baseId, tableName: config.tableName };
  return {};
}
