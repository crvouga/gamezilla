export type HttpProbeResult = { ok: boolean; status: number; error?: string };

/**
 * HTTP probe via global `fetch`. Each request uses the runtime’s DNS resolver
 * (fresh lookups per request in Node/Bun), avoiding a dependency on curl and
 * keeping behavior consistent across operating systems.
 */
export async function httpProbe(
  url: string,
  opts?: { timeoutS?: number }
): Promise<HttpProbeResult> {
  const timeoutS = opts?.timeoutS ?? 30;
  const ms = Math.max(1, timeoutS * 1000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(ms),
      cache: 'no-store',
    });
    const status = res.status;
    const ok = status >= 200 && status < 400;
    return { ok, status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: msg };
  }
}
