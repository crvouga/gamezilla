// @io-wall-ok — browser adapter for the app's right-click menu

import type { BrowserPort, EditCommand } from './ports';

const SEARCH = 'https://duckduckgo.com/?q=';

/** The Navigation API, where the browser has it. */
type HistoryNavigation = {
  readonly canGoBack?: boolean;
  readonly canGoForward?: boolean;
};

/** The picture at `url` as a PNG, the one kind every browser will copy. */
async function asPng(window: Window, url: string): Promise<Blob> {
  const response = await window.fetch(url);
  const bitmap = await window.createImageBitmap(await response.blob());
  const canvas = window.document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No picture'))),
      'image/png'
    )
  );
}

/** What the browser's own context menu does, asked for by the page. */
export function browserPort(window: Window): BrowserPort {
  const { document, navigator, history, location } = window;
  const navigation = (window as unknown as { navigation?: HistoryNavigation })
    .navigation;
  const command = (name: string, value?: string): boolean => {
    try {
      // oxlint-disable-next-line typescript/no-deprecated -- the one way a page can cut, paste into a field, undo and redo as the browser's own menu does
      return document.execCommand(name, false, value);
    } catch {
      return false;
    }
  };
  return {
    writeText: (text) =>
      navigator.clipboard.writeText(text).then(
        () => true,
        () => false
      ),
    readText: () => {
      // Absent outside a secure page, whatever the types say.
      const clipboard = navigator.clipboard as Clipboard | undefined;
      return clipboard
        ? clipboard.readText().catch(() => null)
        : Promise.resolve(null);
    },
    edit: (name: EditCommand) => command(name),
    insertText: (text) => command('insertText', text),
    copyImage: async (url) => {
      try {
        const png = await asPng(window, url);
        await navigator.clipboard.write([
          new (
            window as Window & { ClipboardItem: typeof ClipboardItem }
          ).ClipboardItem({ 'image/png': png }),
        ]);
        return true;
      } catch {
        return false;
      }
    },
    saveImage(url) {
      const link = document.createElement('a');
      link.href = url;
      link.download =
        new URL(url, location.href).pathname.split('/').pop() ?? '';
      link.click();
    },
    openInNewTab: (url) => void window.open(url, '_blank', 'noopener'),
    search: (words) =>
      void window.open(
        `${SEARCH}${encodeURIComponent(words)}`,
        '_blank',
        'noopener'
      ),
    follow: (link) => (link as HTMLElement).click(),
    history: () => ({
      back: navigation?.canGoBack ?? history.length > 1,
      forward: navigation?.canGoForward ?? true,
    }),
    back: () => history.back(),
    forward: () => history.forward(),
    reload: () => location.reload(),
    print: () => window.print(),
    pageUrl: () => location.href,
  };
}
