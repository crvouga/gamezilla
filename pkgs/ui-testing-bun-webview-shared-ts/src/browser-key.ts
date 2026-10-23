import type { BunWebView } from './bun-webview-host';

function browserKeyInit(key: string): KeyboardEventInit {
  const primaryMeta = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
  return {
    key: key === 'Control+k' ? 'k' : key,
    ctrlKey: key === 'Control+k' && !primaryMeta,
    metaKey: key === 'Control+k' && primaryMeta,
    bubbles: true,
    cancelable: true,
  };
}

/** Page-side keyboard behavior: Bun's named-key port only edits text. */
function dispatchBrowserKey(
  selector: string | null,
  key: string,
  init: KeyboardEventInit
): boolean {
  const root =
    selector === null
      ? document.activeElement
      : document.querySelector(selector);
  if (!(root instanceof HTMLElement))
    throw new Error('Keyboard target not found');
  if (!root.contains(document.activeElement)) root.focus();
  const target = root.contains(document.activeElement)
    ? document.activeElement
    : root;
  if (!(target instanceof HTMLElement)) return false;
  const accepted = target.dispatchEvent(new KeyboardEvent('keydown', init));
  const field =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  const button = target.matches(
    'button, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"]'
  );
  if (accepted && key === 'Enter') {
    if (
      target.matches(
        'button, input[type="button"], input[type="submit"], input[type="reset"], a[href]'
      )
    )
      target.click();
    else if (target instanceof HTMLInputElement && target.form !== null)
      target.form.requestSubmit();
  }
  const released = target.dispatchEvent(new KeyboardEvent('keyup', init));
  if (accepted && released && key === ' ' && button) target.click();
  // Browser editing commands remain useful for unhandled text keys and Tab.
  return (
    accepted &&
    (key === 'Tab' ||
      (field &&
        !button &&
        (key !== 'Enter' || target instanceof HTMLTextAreaElement)))
  );
}

export async function pressBrowserKey(
  view: BunWebView,
  key: string,
  selector: string | null = null
): Promise<void> {
  const edit = await view.evaluate(
    `(${dispatchBrowserKey.toString()})(${JSON.stringify(selector)}, ${JSON.stringify(key)}, (${browserKeyInit.toString()})(${JSON.stringify(key)}))`
  );
  if (edit === true) await view.press(key);
}
