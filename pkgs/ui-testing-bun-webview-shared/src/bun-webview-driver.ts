/**
 * Bun.WebView driver — localhost / headless browser actors.
 * Lazy-imported so UI tests never load Bun.WebView.
 */

import type { Timers } from '@pkgs/clock-shared/types';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared/keys';
import { BunWebviewDriverNode } from './bun-webview-driver-node';
import type { BunWebView, BunWebviewHost } from './bun-webview-host';
import type { PopupViewOptions } from './bun-webview-popups';
import { BunWebviewPopups } from './bun-webview-popups';

export type BunWebviewDriverOptions = {
  readonly view: BunWebView;
  readonly baseUrl?: string;
  /** When set, wraps `window.fetch` to send `x-harness-actor` for createHarnessNet partition. */
  readonly actorId?: string;
  /** How popup windows are created (share the page's data store). */
  readonly popupOptions?: PopupViewOptions;
  /** Bounds waits on popup windows (one that closed itself never answers). */
  readonly timers: Timers;
};

export class BunWebviewDriver implements Driver, BunWebviewHost {
  readonly kind = 'bun-webview';
  readonly view: BunWebView;
  private readonly baseUrl: string | undefined;
  private readonly actorId: string | undefined;
  private readonly popups: BunWebviewPopups;

  constructor(options: BunWebviewDriverOptions) {
    this.view = options.view;
    this.baseUrl = options.baseUrl;
    this.actorId = options.actorId;
    this.popups = new BunWebviewPopups(
      options.timers,
      this.view,
      () => this.prepareDocument(),
      options.popupOptions
    );
  }

  async launch(): Promise<void> {
    if (this.baseUrl !== undefined) {
      await this.view.navigate(this.baseUrl);
    }
    await this.popups.sync();
  }

  async resolveView(selector: string): Promise<BunWebView> {
    await this.popups.sync();
    const popup = this.popups.current;
    if (popup === null) return this.view;
    const inPopup = await popup.evaluate(
      `document.querySelector(${JSON.stringify(selector)}) !== null`
    );
    return inPopup === true ? popup : this.view;
  }

  /** Per-document setup, re-run whenever the page loads a new document. */
  private async prepareDocument(): Promise<void> {
    const actorId = this.actorId;
    if (actorId === undefined) return;
    await this.view.evaluate(
      `(function(){
        var id = ${JSON.stringify(actorId)};
        var orig = window.fetch.bind(window);
        window.fetch = function(input, init) {
          var headers = new Headers(init && init.headers ? init.headers : undefined);
          headers.set('x-harness-actor', id);
          return orig(input, Object.assign({}, init || {}, { headers: headers }));
        };
      })()`
    );
  }

  async close(): Promise<void> {
    await this.popups.closeAll();
    this.view.close();
  }

  get(testId: string): DriverNode {
    return new BunWebviewDriverNode(this, [testId]);
  }

  async key(key: DriverKey): Promise<void> {
    await this.view.press(DRIVER_KEY_TO_DOM[key]);
  }

  async snapshotHtml(): Promise<string | null> {
    const html = await this.view.evaluate('document.documentElement.outerHTML');
    return typeof html === 'string' ? html : null;
  }
}
