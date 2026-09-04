/**
 * Shared `Bun.WebView` surface. Lives apart from the driver so the driver and
 * its locator node can both depend on it without importing each other.
 */

export type BunWebView = {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  screenshot(): Promise<Blob | Uint8Array | Buffer>;
  close(): void;
};

export type BunWebviewHost = {
  readonly view: BunWebView;
};
