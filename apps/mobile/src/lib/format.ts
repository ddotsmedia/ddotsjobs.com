export function rupees(paise: number | null, disclosed = true): string {
  if (!disclosed || paise == null) return 'Salary not disclosed';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}/mo`;
}

export function relativeTime(d: string | Date | null | undefined): string {
  if (!d) return '';
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
