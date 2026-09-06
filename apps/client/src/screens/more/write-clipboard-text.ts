/**
 * Clipboard sink for `CopyToClipboardField`. DOM boundary: the browser
 * clipboard is a user-gesture API with no injectable port; hosts without it
 * (happy-dom, insecure contexts) resolve without writing.
 */
export function writeClipboardText(text: string): Promise<void> {
  const clipboard = (
    globalThis as {
      navigator?: { clipboard?: { writeText(t: string): Promise<void> } };
    }
  ).navigator?.clipboard;
  if (clipboard === undefined) return Promise.resolve();
  return clipboard.writeText(text);
}
