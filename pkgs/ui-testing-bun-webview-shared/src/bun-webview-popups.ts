// @io-wall-ok — test harness: opens real Bun.WebView windows for page popups.
/**
 * `window.open` for a `Bun.WebView` page.
 *
 * `Bun.WebView` has no popups: `window.open` returns `null`, so a page that
 * signs in through a popup sees a blocked window. This module gives the page
 * the popup a browser would: `window.open` opens a second `Bun.WebView` at the
 * requested URL (with the requested window name), and returns a handle that
 * behaves like the `WindowProxy` a browser returns — `closed`, `close()`,
 * `focus()`, and a `location` that is readable only while the popup is on the
 * opener's origin (it throws a `SecurityError` while cross-origin, as a
 * browser's does).
 *
 * Separate `Bun.WebView`s share no storage and no `BroadcastChannel`, so the
 * popup's URL is mirrored into that handle on every {@link BunWebviewPopups.sync}
 * — which is how an opener that polls `popup.location.href` learns where the
 * popup landed.
 */

import type { Timers } from '@pkgs/clock-shared/types';

import type { BunWebView } from './bun-webview-host';

const POPUP_SIZE = { width: 520, height: 680 } as const;

/** A popup that closed itself never answers; don't wait on it forever. */
const POPUP_CALL_MS = 10_000;

async function within<T>(
  timers: Timers,
  work: Promise<T>,
  what: string
): Promise<T> {
  let timer: ReturnType<Timers['setTimeout']> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = timers.setTimeout(
      () => reject(new Error(`popup: ${what} did not answer`)),
      POPUP_CALL_MS
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) timers.clearTimeout(timer);
  }
}

/** Options every popup window is created with (its opener's data store). */
export type PopupViewOptions = {
  readonly dataStore?: 'ephemeral' | { readonly directory: string };
  readonly backend?: Bun.WebView.Backend;
};

/** Installed into every document the opener loads (idempotent). */
const OPENER_SHIM = `(function(){
  if (window.__bunWebviewPopups) return true;
  var popups = { next: 1, open: [] };
  window.__bunWebviewPopups = popups;
  window.open = function(url, name) {
    var entry = {
      id: popups.next++,
      url: new URL(String(url || 'about:blank'), location.href).href,
      name: typeof name === 'string' ? name : '',
      href: null,
      closed: false,
      taken: false
    };
    popups.open.push(entry);
    return {
      get closed() { return entry.closed; },
      get location() {
        if (entry.href === null || new URL(entry.href).origin !== location.origin) {
          throw new DOMException('Blocked a frame from accessing a cross-origin frame.', 'SecurityError');
        }
        return { href: entry.href };
      },
      close: function() { entry.closed = true; },
      focus: function() {},
      postMessage: function() {}
    };
  };
  return false;
})()`;

type PopupEntry = {
  readonly id: number;
  readonly url: string;
  readonly name: string;
  readonly closed: boolean;
  readonly taken: boolean;
};

type PopupView = BunWebView & {
  readonly url?: string;
  readonly loading?: boolean;
};

type OpenPopup = {
  readonly id: number;
  readonly name: string;
  readonly view: PopupView;
  /** Whether the window name has been given to the loaded page yet. */
  named: boolean;
};

function isEntries(value: unknown): value is readonly PopupEntry[] {
  return Array.isArray(value);
}

export class BunWebviewPopups {
  private readonly open = new Map<number, OpenPopup>();

  constructor(
    private readonly timers: Timers,
    private readonly opener: BunWebView,
    /** Runs after the shim lands in a fresh document (e.g. fetch wrappers). */
    private readonly onFreshDocument: () => Promise<void>,
    /** A popup is a window of the same browser: it shares the opener's store. */
    private readonly viewOptions: PopupViewOptions = {}
  ) {}

  /** The most recently opened popup still open, if any. */
  get current(): BunWebView | null {
    let latest: OpenPopup | null = null;
    for (const popup of this.open.values()) {
      if (latest === null || popup.id > latest.id) latest = popup;
    }
    return latest?.view ?? null;
  }

  /**
   * Reconcile popup windows with the opener's `window.open` calls: open new
   * ones, close the ones the opener closed, and mirror each popup's URL back.
   */
  async sync(): Promise<void> {
    const alreadyInstalled = await this.opener.evaluate(OPENER_SHIM);
    if (alreadyInstalled !== true) await this.onFreshDocument();
    const raw = await this.opener.evaluate(
      `JSON.stringify((window.__bunWebviewPopups || { open: [] }).open.map(function(e){ var taken = e.taken; e.taken = true; return { id: e.id, url: e.url, name: e.name, closed: e.closed, taken: taken }; }))`
    );
    const entries = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : [];
    if (!isEntries(entries)) return;
    for (const entry of entries) await this.reconcile(entry);
  }

  async closeAll(): Promise<void> {
    for (const popup of this.open.values()) popup.view.close();
    this.open.clear();
  }

  private async reconcile(entry: PopupEntry): Promise<void> {
    const popup = this.open.get(entry.id);
    if (entry.closed) {
      popup?.view.close();
      this.open.delete(entry.id);
      return;
    }
    if (popup === undefined) {
      if (!entry.taken) await this.launch(entry);
      return;
    }
    const href = popup.view.url;
    if (typeof href !== 'string' || !href.startsWith('http')) return;
    if (!popup.named && popup.view.loading !== true) {
      // The window name survives same-site navigations: a page that lands
      // back on the opener's site can tell it is the popup it was opened as.
      const named = await within(
        this.timers,
        popup.view.evaluate(`window.name = ${JSON.stringify(popup.name)}`),
        'naming'
      ).then(
        () => true,
        () => false
      );
      if (!named) {
        this.drop(entry.id);
        return;
      }
      popup.named = true;
    }
    await this.opener.evaluate(
      `(function(){ var p = window.__bunWebviewPopups; if (!p) return; p.open.forEach(function(e){ if (e.id === ${String(entry.id)}) e.href = ${JSON.stringify(href)}; }); })()`
    );
  }

  /** Forget a popup window that no longer answers (it closed itself). */
  private drop(id: number): void {
    const popup = this.open.get(id);
    this.open.delete(id);
    try {
      popup?.view.close();
    } catch {
      // already gone
    }
  }

  private async launch(entry: PopupEntry): Promise<void> {
    const view: PopupView = new Bun.WebView({
      ...POPUP_SIZE,
      ...this.viewOptions,
    });
    this.open.set(entry.id, {
      id: entry.id,
      name: entry.name,
      view,
      named: false,
    });
    await within(this.timers, view.navigate(entry.url), 'loading').catch(() =>
      this.drop(entry.id)
    );
  }
}
