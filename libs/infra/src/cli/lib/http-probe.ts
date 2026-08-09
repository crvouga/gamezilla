import * as dns from 'dns/promises';
import * as http from 'http';
import * as https from 'https';
import { cliIo } from './cli-io';

interface HealthResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  resolvedIp?: string;
  error?: string;
  body?: string;
}

export async function httpProbe(
  rawUrl: string,
  timeoutMs = 5000
): Promise<HealthResult> {
  const start = cliIo.clock.now();
  const url = new URL(rawUrl);
  const isHttps = url.protocol === 'https:';
  const hostname = url.hostname;
  const port = url.port || (isHttps ? '443' : '80');

  // 1. Force fresh DNS resolution — bypass all Node/OS caching
  let resolvedIp: string;
  try {
    const results = await dns.resolve4(hostname); // or resolve6 for IPv6
    const first = results[0];
    if (first === undefined) {
      return {
        ok: false,
        durationMs: cliIo.clock.now() - start,
        error: 'DNS returned no A records',
      };
    }
    resolvedIp = first;
  } catch (err) {
    return {
      ok: false,
      durationMs: cliIo.clock.now() - start,
      error: `DNS failed: ${err instanceof Error ? err.message : String(err)}`,
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
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (body.length < 4096) body += chunk;
        });
        res.on('end', () => {
          const durationMs = cliIo.clock.now() - start;
          const statusCode = res.statusCode;
          const base: HealthResult = {
            ok: (statusCode ?? 0) < 500,
            durationMs,
            resolvedIp,
          };
          let out: HealthResult = base;
          if (statusCode !== undefined) {
            out = { ...out, status: statusCode };
          }
          if (body.length > 0) {
            out = { ...out, body };
          }
          resolve(out);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        durationMs: cliIo.clock.now() - start,
        error: 'Timeout',
        resolvedIp,
      });
    });

    req.on('error', (err) => {
      resolve({
        ok: false,
        durationMs: cliIo.clock.now() - start,
        error: err.message,
        resolvedIp,
      });
    });

    req.end();
  });
}
