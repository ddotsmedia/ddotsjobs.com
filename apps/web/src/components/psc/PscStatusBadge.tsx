import { PSC_STATUS } from '@/lib/constants';

export function PscStatusBadge({ status }: { status: string }) {
  const cfg = PSC_STATUS[status] ?? PSC_STATUS.active!;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        padding: '3px 10px',
        borderRadius: '9999px',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}
