export type HttpProbeResult = { ok: boolean; status: number; error?: string };

/**
 * HTTP probe via curl subprocess. Using curl instead of Bun's fetch avoids
 * stale negative DNS cache entries that persist within a long-running Bun
 * process (e.g. after a destroy → recreate cycle where DNS records change
 * mid-run). Each curl invocation gets a fresh DNS resolution.
 */
export async function httpProbe(
  url: string,
  opts?: { timeoutS?: number }
): Promise<HttpProbeResult> {
  const timeoutS = opts?.timeoutS ?? 30;
  try {
    const proc = Bun.spawn(
      [
        'curl',
        '-s',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code}',
        '-L',
        '--max-time',
        String(timeoutS),
        url,
      ],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);

    const status = parseInt(stdout.trim(), 10);

    if (exitCode !== 0 || isNaN(status) || status === 0) {
      const stderr = await new Response(proc.stderr).text();
      return {
        ok: false,
        status: 0,
        error: stderr.trim() || `curl exit ${exitCode}`,
      };
    }

    return { ok: status >= 200 && status < 400, status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: msg };
  }
}
