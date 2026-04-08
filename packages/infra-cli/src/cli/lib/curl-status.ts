import { runSafe } from '../subprocess';

const IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

/**
 * Resolve a hostname via Cloudflare's public DNS (1.1.1.1),
 * bypassing stale local DNS caches. Tries A first, falls back to AAAA
 * (Workers custom domains only have an AAAA record: `100::`).
 */
export function resolveVia1111(hostname: string): string | null {
  const a = runSafe('dig', ['+short', hostname, 'A', '@1.1.1.1']);
  if (a.exitCode === 0) {
    const ipv4 = a.stdout.split('\n').map((l) => l.trim()).find((l) => IPV4_RE.test(l));
    if (ipv4) return ipv4;
  }

  const aaaa = runSafe('dig', ['+short', hostname, 'AAAA', '@1.1.1.1']);
  if (aaaa.exitCode === 0) {
    const ipv6 = aaaa.stdout.split('\n').map((l) => l.trim()).find((l) => IPV6_RE.test(l) && l.includes(':'));
    if (ipv6) return ipv6;
  }

  return null;
}

export type CurlResult = { ok: boolean; status: number; error?: string };

/**
 * HTTP probe via curl, resolving DNS through 1.1.1.1 to bypass local cache.
 * Returns the HTTP status code, or `{ status: 0 }` if the request failed entirely.
 */
export function curlStatus(
  url: string,
  opts?: { timeoutS?: number }
): CurlResult {
  const timeoutS = opts?.timeoutS ?? 30;
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  const ip = resolveVia1111(hostname);

  const args = [
    '-s',
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    '--max-time',
    String(timeoutS),
    '-L',
  ];

  if (ip) {
    args.push('--resolve', `${hostname}:${port}:${ip}`);
  }

  args.push(url);

  const r = runSafe('curl', args);
  if (r.exitCode !== 0) {
    return {
      ok: false,
      status: 0,
      error: r.stderr.trim() || `curl exit ${r.exitCode}`,
    };
  }
  const status = parseInt(r.stdout.trim(), 10);
  if (Number.isNaN(status)) {
    return {
      ok: false,
      status: 0,
      error: `unexpected curl output: ${r.stdout.trim()}`,
    };
  }
  return { ok: status >= 200 && status < 400, status };
}
