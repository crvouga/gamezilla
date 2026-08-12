// @io-wall-ok — browser SPA wall HTTP for the simulation-report viewer.
/**
 * Report SPA runs in the browser against the local Bun report server.
 * Product code must not call bare `fetch`; this entry-shaped adapter is the
 * only wall boundary for viewer HTTP.
 */
export function reportFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return globalThis.fetch(input, init);
}

/** Wall monotonic clock for long-hold countdown (viewer only). */
export function wallNowMs(): number {
  return performance.now();
}

export function wallRequestAnimationFrame(
  callback: FrameRequestCallback
): number {
  return requestAnimationFrame(callback);
}

export function wallCancelAnimationFrame(handle: number): void {
  cancelAnimationFrame(handle);
}

/** Wall clipboard for Copy prompt (viewer only). */
export async function wallClipboardWriteText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
