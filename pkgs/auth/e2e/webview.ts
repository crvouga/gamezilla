// @io-wall-ok — Bun.WebView e2e host poll loop
export type EvalView = {
  evaluate(script: string): Promise<unknown>;
};

/**
 * Bun's default engine: WebKit on macOS, Chrome elsewhere (Linux CI).
 * `AUTH_E2E_WEBVIEW=chrome` runs the Linux engine on macOS too. The page is
 * loaded with an awaited `navigate`: a Chrome view constructed with `url`
 * has no page to evaluate in yet (`Runtime.evaluate wasn't found`).
 */
export async function openView(url: string): Promise<Bun.WebView> {
  const view = new Bun.WebView({
    width: 1280,
    height: 800,
    ...(process.env['AUTH_E2E_WEBVIEW'] === 'chrome'
      ? { backend: 'chrome' as const }
      : {}),
  });
  await view.navigate(url);
  return view;
}

export async function waitFor(
  view: EvalView,
  expr: string,
  timeoutMs = 15_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await view.evaluate(`Boolean(${expr})`);
    if (ok) return;
    await Bun.sleep(50);
  }
  throw new Error(`timed out waiting for ${expr}`);
}

export async function evalJson<T>(view: EvalView, expr: string): Promise<T> {
  const raw = await view.evaluate(`JSON.stringify(${expr})`);
  if (typeof raw !== 'string') {
    throw new Error(`evalJson expected string, got ${typeof raw}`);
  }
  return JSON.parse(raw) as T;
}

export async function waitForHttp(
  url: string,
  timeoutMs = 30_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not up yet
    }
    await Bun.sleep(100);
  }
  throw new Error(`timed out waiting for ${url}`);
}

export async function fetchRedirectLocation(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'manual' });
  return res.headers.get('location') ?? '';
}
