/**
 * Bun.WebView driver — localhost / headless browser actors.
 * Lazy-imported so Jest RNTL workers never load Bun.WebView.
 */

import { DRIVER_KEY_TO_DOM, type DriverKey } from '../../core/keys';
import type { Driver, DriverNode } from '../../driver/driver';
import {
  BunWebviewDriverNode,
  type BunWebviewHost,
} from './bun-webview-driver-node';

export type BunWebView = {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  screenshot(): Promise<Blob | Uint8Array | Buffer>;
  close(): void;
};

export type BunWebviewDriverOptions = {
  readonly view: BunWebView;
  readonly baseUrl?: string;
};

export class BunWebviewDriver implements Driver, BunWebviewHost {
  readonly kind = 'bun-webview';
  readonly view: BunWebView;
  private readonly baseUrl: string | undefined;

  constructor(options: BunWebviewDriverOptions) {
    this.view = options.view;
    this.baseUrl = options.baseUrl;
  }

  async launch(): Promise<void> {
    if (this.baseUrl !== undefined) {
      await this.view.navigate(this.baseUrl);
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
