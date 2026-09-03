import { counterAppHtml } from './counter-app-html';
import type { Page } from './page';

type WebViewLike = {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  evaluate(expr: string): Promise<unknown>;
  reload(): Promise<void>;
  close(): void;
  loading: boolean;
};

async function waitLoaded(view: WebViewLike): Promise<void> {
  for (let i = 0; i < 200 && view.loading; i += 1) {
    await Bun.sleep(10);
  }
  await Bun.sleep(20);
}

let cachedAvailable: boolean | undefined;

/** True when `new Bun.WebView()` can spawn (macOS WebKit / Chrome). */
export function webViewAvailable(): boolean {
  if (cachedAvailable !== undefined) return cachedAvailable;
  if (typeof Bun.WebView !== 'function') {
    cachedAvailable = false;
    return false;
  }
  try {
    const probe = new Bun.WebView({ width: 100, height: 100 });
    probe.close();
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

export async function openWebViewPage(): Promise<Page> {
  if (!webViewAvailable()) {
    throw new Error('Bun.WebView unavailable in this environment');
  }
  const errors: string[] = [];
  const html = counterAppHtml;
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    },
  });
  const origin = `http://127.0.0.1:${server.port}`;
  let view: WebViewLike;
  try {
    view = new Bun.WebView({
      width: 480,
      height: 640,
      console: (...args: unknown[]) => {
        const line = args.map(String).join(' ');
        if (/error/i.test(line)) errors.push(line);
      },
    }) as unknown as WebViewLike;
  } catch (error) {
    server.stop(true);
    throw error;
  }

  try {
    await view.navigate(`${origin}/`);
    await waitLoaded(view);
  } catch (error) {
    view.close();
    server.stop(true);
    throw error;
  }

  return {
    async click(selector) {
      await view.click(selector);
      await Bun.sleep(20);
    },
    async text(selector) {
      const t = await view.evaluate(
        `document.querySelector(${JSON.stringify(selector)})?.textContent ?? ''`
      );
      return String(t).trim();
    },
    async routeAttr() {
      const t = await view.evaluate(
        `document.querySelector('#app')?.getAttribute('data-screen') ?? null`
      );
      return t === null ? null : String(t);
    },
    async reload() {
      await view.reload();
      await waitLoaded(view);
    },
    consoleErrors() {
      return errors;
    },
    async dispose() {
      view.close();
      server.stop(true);
    },
  };
}
