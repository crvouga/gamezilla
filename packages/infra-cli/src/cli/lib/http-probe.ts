export type HttpProbeResult = { ok: boolean; status: number; error?: string };

/**
 * HTTP probe using the Web-standard fetch API. Bun's fetch uses c-ares for
 * DNS and supports Happy Eyeballs (parallel IPv4/IPv6), matching how modern
 * browsers resolve and connect — avoiding the dig/resolver mismatches
 * that plague macOS when negative DNS caches are stale.
 */
export async function httpProbe(
  url: string,
  opts?: { timeoutS?: number }
): Promise<HttpProbeResult> {
  const timeoutS = opts?.timeoutS ?? 30;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutS * 1000),
    });
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: msg };
  }
}
