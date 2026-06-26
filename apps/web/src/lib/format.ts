// Display formatters. Money is paise (integer); rupees = paise / 100.

export function rupeesPerMonth(paise: number | null, disclosed = true): string {
  if (!disclosed) return 'Market rate';
  if (paise == null) return 'Salary undisclosed';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}/mo`;
}

export function relativeTime(d: Date | string | null): string {
  if (!d) return 'recently';
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export function walkInDateLabel(d: Date | string | null): string {
  if (!d) return 'Walk-in';
  const date = new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `Walk-in ${date}`;
}

export function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Whole days from now until d (negative if past). */
export function daysUntil(d: Date | string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export function daysLeftLabel(d: Date | string | null): string {
  const n = daysUntil(d);
  if (n == null) return '';
  if (n < 0) return 'past';
  if (n === 0) return 'today';
  return `${n} day${n === 1 ? '' : 's'} left`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
