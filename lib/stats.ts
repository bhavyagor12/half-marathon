/** Open, visible tabs send a heartbeat this often; a session counts as online for ONLINE_WINDOW_MS after its last one. */
export const HEARTBEAT_MS = 30_000;
export const ONLINE_WINDOW_MS = 75_000;
export type SiteStats = {views: number; visitors: number; online: number};

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

async function hmacKey(secret: string) {
  // Domain-separated, so the derived key is useless for anything else the secret protects.
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(`slowrun-stats:${secret}`));
  return crypto.subtle.importKey('raw', raw, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
}

/** A session token is `<session>.<hmac>`. Only the server can mint one, so heartbeats cannot invent online sessions. */
export async function signSession(session: string, secret: string) {
  return `${session}.${hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(session)))}`;
}

export async function verifySession(token: unknown, secret: string) {
  if (!secret || typeof token !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) return null;
  const session = token.slice(0, 64);
  // Compare digests, so the time taken never reveals how much of a forged signature matched.
  const [expected, given] = await Promise.all(
    [await signSession(session, secret), token].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))),
  );
  return hex(expected) === hex(given) ? session : null;
}

/** Crawlers, link unfurlers and scripts don't count as visits. Real browsers still pass through the per-IP rate limit. */
export function isLikelyBot(userAgent: string | null) {
  return !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|embedly|headless|lighthouse|pingdom|uptime|curl|wget|python|node-fetch|axios|go-http/i.test(userAgent);
}

export function toStats(value: unknown): SiteStats | null {
  if (!value || typeof value !== 'object') return null;
  const {views, visitors, online} = value as Record<string, unknown>;
  const numbers = [views, visitors, online].map(Number);
  return numbers.every(Number.isFinite) ? {views: numbers[0], visitors: numbers[1], online: numbers[2]} : null;
}

export function formatCount(n: number) {
  return n < 10_000 ? n.toLocaleString('en-US') : new Intl.NumberFormat('en-US', {notation: 'compact', maximumFractionDigits: 1}).format(n);
}
