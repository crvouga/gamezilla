import * as dns from 'dns/promises';
import * as http from 'http';
import * as https from 'https';

interface HealthResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  resolvedIp?: string;
  error?: string;
}

export async function httpProbe(
  rawUrl: string,
  timeoutMs = 5000
): Promise<HealthResult> {
  const start = Date.now();
  const url = new URL(rawUrl);
  const isHttps = url.protocol === 'https:';
  const hostname = url.hostname;
  const port = url.port || (isHttps ? '443' : '80');

  // 1. Force fresh DNS resolution — bypass all Node/OS caching
  let resolvedIp: string;
  try {
    const results = await dns.resolve4(hostname); // or resolve6 for IPv6
    resolvedIp = results[0];
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: `DNS failed: ${err}`,
    };
  }

  // 2. Make request directly to the IP, pass original hostname in Host header
  //    This bypasses http.globalAgent's connection pooling/DNS cache entirely
  return new Promise((resolve) => {
    const lib = isHttps ? https : http;

    const req = lib.request(
      {
        hostname: resolvedIp, // connect to IP directly
        port,
        path: url.pathname + url.search,
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          Host: hostname, // required — TLS SNI + virtual hosting
          'User-Agent': 'healthcheck/1.0',
        },
        // For HTTPS: SNI must match the real hostname, not the IP
        ...(isHttps && { servername: hostname }),
      },
      (res) => {
        res.resume(); // drain the body so the socket closes cleanly
        resolve({
          ok: (res.statusCode ?? 0) < 500,
          status: res.statusCode,
          durationMs: Date.now() - start,
          resolvedIp,
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        durationMs: Date.now() - start,
        error: 'Timeout',
        resolvedIp,
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        durationMs: Date.now() - start,
        error: err.message,
        resolvedIp,
      });
    });

    req.end();
  });
}
