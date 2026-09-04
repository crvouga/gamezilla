// @io-wall-ok — Bun.WebView e2e host poll loop
export type EvalView = {
  evaluate(script: string): Promise<unknown>;
};

export function openView(url: string): Bun.WebView {
  return new Bun.WebView({ url, width: 1280, height: 800 });
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

export async function evalFn<T>(
  view: EvalView,
  fn: string,
  args: unknown
): Promise<T> {
  const raw = await view.evaluate(
    `(async function(){ return JSON.stringify(await (${fn})(${JSON.stringify(args)})); })()`
  );
  if (typeof raw !== 'string') {
    throw new Error(`evalFn expected string, got ${typeof raw}`);
  }
  return JSON.parse(raw) as T;
}
