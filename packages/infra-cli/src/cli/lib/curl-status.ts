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
    const ipv4 = a.stdout
      .split('\n')
      .map((l) => l.trim())
      .find((l) => IPV4_RE.test(l));
    if (ipv4) return ipv4;
  }

  const aaaa = runSafe('dig', ['+short', hostname, 'AAAA', '@1.1.1.1']);
  if (aaaa.exitCode === 0) {
    const ipv6 = aaaa.stdout
      .split('\n')
      .map((l) => l.trim())
      .find((l) => IPV6_RE.test(l) && l.includes(':'));
    if (ipv6) return ipv6;
  }

  return null;
}

export type CurlResult = { ok: boolean; status: number; error?: string };

const CURL_CONNECTION_ERRORS = new Set([
  6, // CURLE_COULDNT_RESOLVE_HOST
  7, // CURLE_COULDNT_CONNECT
  28, // CURLE_OPERATION_TIMEDOUT
  35, // CURLE_SSL_CONNECT_ERROR
]);

function parseCurlOutput(stdout: string, exitCode: number, stderr: string): CurlResult {
  if (exitCode !== 0) {
    return {
      ok: false,
      status: 0,
      error: stderr.trim() || `curl exit ${exitCode}`,
    };
  }
  const status = parseInt(stdout.trim(), 10);
  if (Number.isNaN(status)) {
    return { ok: false, status: 0, error: `unexpected curl output: ${stdout.trim()}` };
  }
  return { ok: status >= 200 && status < 400, status };
}

/**
 * HTTP probe via curl, resolving DNS through 1.1.1.1 to bypass local cache.
 * Falls back to system DNS (with Happy Eyeballs) when the pinned IP is
 * unreachable — this handles Workers custom domains where the A record may
 * not exist yet and the resolved IPv6 address isn't reachable locally.
 */
export function curlStatus(
  url: string,
  opts?: { timeoutS?: number }
): CurlResult {
  const timeoutS = opts?.timeoutS ?? 30;
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

  const baseArgs = [
    '-s',
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    '--max-time',
    String(timeoutS),
    '-L',
  ];

  const ip = resolveVia1111(hostname);

  if (ip) {
    const r = runSafe('curl', [
      ...baseArgs,
      '--resolve',
      `${hostname}:${port}:${ip}`,
      url,
    ]);
    const exit = r.exitCode ?? 1;
    if (!CURL_CONNECTION_ERRORS.has(exit)) {
      return parseCurlOutput(r.stdout, exit, r.stderr);
    }
    // Pinned IP unreachable — fall through to system DNS so curl can try
    // all addresses via Happy Eyeballs (IPv4 + IPv6 in parallel).
  }

  const r = runSafe('curl', [...baseArgs, url]);
  return parseCurlOutput(r.stdout, r.exitCode ?? 1, r.stderr);
}
