import { pressBrowserKey } from './browser-key';
/**
 * Bun.WebView driver — localhost / headless browser actors.
 * Lazy-imported so UI tests never load Bun.WebView.
 */

import type { Timers } from '@pkgs/clock-shared-ts/types';
import { readDomInventory } from '@pkgs/ui-testing-root-shared-ts/dom-inventory';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import type { Inventory } from '@pkgs/ui-testing-root-shared-ts/inventory';
import type { DriverKey } from '@pkgs/ui-testing-root-shared-ts/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared-ts/keys';
import { BunWebviewDriverNode } from './bun-webview-driver-node';
import type { BunWebView, BunWebviewHost } from './bun-webview-host';
import type { PopupViewOptions } from './bun-webview-popups';
import { BunWebviewPopups } from './bun-webview-popups';

export type BunWebviewDriverOptions = {
  readonly view: BunWebView;
  readonly baseUrl?: string;
  /** Read a synchronous visibility predicate in the identified main document. */
  readonly readDocumentVisibility?: (expression: string) => Promise<boolean>;
  /** When set, wraps `window.fetch` to send `x-harness-actor` for createHarnessNet partition. */
  readonly actorId?: string;
  /** How popup windows are created (share the page's data store). */
  readonly popupOptions?: PopupViewOptions;
  /** Bounds waits on unresponsive windows. */
  readonly timers: Timers;
};

export class BunWebviewDriver implements Driver, BunWebviewHost {
  readonly timers: Timers;
  readonly kind = 'bun-webview';
  readonly view: BunWebView;
  private readonly baseUrl: string | undefined;
  private readonly actorId: string | undefined;
  private readonly popups: BunWebviewPopups;
  private readonly documentHost: BunWebviewHost;

  constructor(options: BunWebviewDriverOptions) {
    this.timers = options.timers;
    this.view = options.view;
    this.documentHost = {
      timers: options.timers,
      resolveView: () => Promise.resolve(this.view),
      ...(options.readDocumentVisibility && {
        readVisibility: options.readDocumentVisibility,
      }),
    };
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
    return (await this.popups.showing(selector)) ?? this.view;
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

  /** Same-tab navigation already identifies the document containing its controls. */
  get(testId: string, scope?: 'document'): DriverNode {
    const host = scope === 'document' ? this.documentHost : this;
    return new BunWebviewDriverNode(host, [testId]);
  }

  async key(key: DriverKey): Promise<void> {
    await pressBrowserKey(this.view, DRIVER_KEY_TO_DOM[key]);
  }

  async snapshotHtml(): Promise<string | null> {
    // Between one page and the next there is no document element: nothing
    // to show, not an error.
    const html = await this.view.evaluate(
      'document.documentElement?.outerHTML ?? null'
    );
    return typeof html === 'string' ? html : null;
  }
  async inventory(): Promise<Inventory> {
    return (await this.view.evaluate(
      `(${readDomInventory.toString()})(document)`
    )) as Inventory;
  }
}
