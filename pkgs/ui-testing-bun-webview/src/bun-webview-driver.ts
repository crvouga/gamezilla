/**
 * Bun.WebView driver — localhost / headless browser actors.
 * Lazy-imported so RNTL tests never load Bun.WebView.
 */

import { DRIVER_KEY_TO_DOM, type DriverKey } from '@pkgs/ui-testing/core/keys';
import type { Driver, DriverNode } from '@pkgs/ui-testing/driver/driver';
import { BunWebviewDriverNode } from './bun-webview-driver-node';
import type { BunWebView, BunWebviewHost } from './bun-webview-host';

export type BunWebviewDriverOptions = {
  readonly view: BunWebView;
  readonly baseUrl?: string;
  /** When set, wraps `window.fetch` to send `x-sim-actor` for createSimNet partition. */
  readonly actorId?: string;
};

export class BunWebviewDriver implements Driver, BunWebviewHost {
  readonly kind = 'bun-webview';
  readonly view: BunWebView;
  private readonly baseUrl: string | undefined;
  private readonly actorId: string | undefined;

  constructor(options: BunWebviewDriverOptions) {
    this.view = options.view;
    this.baseUrl = options.baseUrl;
    this.actorId = options.actorId;
  }

  async launch(): Promise<void> {
    if (this.baseUrl !== undefined) {
      await this.view.navigate(this.baseUrl);
    }
    const actorId = this.actorId;
    if (actorId !== undefined) {
      await this.view.evaluate(
        `(function(){
          var id = ${JSON.stringify(actorId)};
          var orig = window.fetch.bind(window);
          window.fetch = function(input, init) {
            var headers = new Headers(init && init.headers ? init.headers : undefined);
            headers.set('x-sim-actor', id);
            return orig(input, Object.assign({}, init || {}, { headers: headers }));
          };
        })()`
      );
    }
  }

  async close(): Promise<void> {
    this.view.close();
  }

  get(testId: string): DriverNode {
    return new BunWebviewDriverNode(this, [testId]);
  }

  async key(key: DriverKey): Promise<void> {
    const domKey = DRIVER_KEY_TO_DOM[key];
    await this.view.evaluate(
      `(function(){ const e = new KeyboardEvent('keydown', { key: ${JSON.stringify(domKey)}, bubbles: true }); document.activeElement?.dispatchEvent(e); })()`
    );
  }

  async snapshotHtml(): Promise<string | null> {
    const html = await this.view.evaluate('document.documentElement.outerHTML');
    return typeof html === 'string' ? html : null;
  }
}
