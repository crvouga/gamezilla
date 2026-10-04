/** Web-only clipboard write (async Clipboard API). Fails silently when the
 * browser has no clipboard surface. */
export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    return;
  }
  await navigator.clipboard.writeText(text);
}
