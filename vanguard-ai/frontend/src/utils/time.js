/**
 * Time helpers.
 *
 * The backend emits naive UTC ISO timestamps (datetime.utcnow().isoformat(),
 * e.g. "2026-08-02T08:20:54.159722") with NO timezone marker. The browser
 * parses a timezone-less datetime as LOCAL time, so every displayed time ends
 * up off by the viewer's UTC offset (e.g. ~5.5h in IST → "5h ago"). These
 * helpers force UTC parsing so times display correctly in the local zone.
 */

export function parseServerDate(value) {
  if (!value) return null;
  // Trust an explicit timezone (Z or ±HH:MM); otherwise treat the value as UTC.
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasTz ? value : `${value}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function timeAgo(value) {
  const d = parseServerDate(value);
  if (!d) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 0) return 'just now';
  if (secs < 45) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function formatDateTime(
  value,
  opts = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
) {
  const d = parseServerDate(value);
  return d ? d.toLocaleString(undefined, opts) : '—';
}

export function formatDate(value, opts = { month: 'short', day: 'numeric' }) {
  const d = parseServerDate(value);
  return d ? d.toLocaleDateString(undefined, opts) : '';
}
