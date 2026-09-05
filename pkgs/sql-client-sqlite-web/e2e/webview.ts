// @io-wall-ok — Bun.WebView e2e host poll loop

import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROFILE = join(tmpdir(), 'gamezilla-sql-client-sqlite-web-e2e');
mkdirSync(PROFILE, { recursive: true });

export type EvalView = {
  evaluate(script: string): Promise<unknown>;
  navigate(url: string): Promise<void>;
  close(): void;
};

/**
 * Chromium, not WKWebView: SharedWorker + OPFS are what these tests cover.
 * One on-disk profile so two "tabs" share storage like a browser context.
 */
export async function openView(url: string): Promise<Bun.WebView> {
  const view = new Bun.WebView({
    width: 1280,
    height: 800,
    backend: 'chrome',
    dataStore: { directory: PROFILE },
  });
  await view.navigate(url);
  return view;
}

export function closeView(view: { close(): void }): void {
  try {
    view.close();
  } catch {
    // renderer already gone
  }
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
    `(async function(){
      var result = await (${fn})(${JSON.stringify(args)});
      return JSON.stringify(result === undefined ? null : result);
    })()`
  );
  if (typeof raw !== 'string') {
    throw new Error(`evalFn expected string, got ${typeof raw}`);
  }
  return JSON.parse(raw) as T;
}
