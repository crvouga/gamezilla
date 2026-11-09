import { expect, test } from 'bun:test';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';
import { nativeClick } from '@pkgs/ui-testing-bun-webview-shared-ts/native-click';
import { Window } from 'happy-dom';

test('a trusted nested-target click remains acknowledged after its handler removes its ancestors', async () => {
  // regression: browser-click-acknowledgement-after-target-removal
  const window = new Window();
  window.document.body.innerHTML =
    '<section data-testid="edition"><button data-testid="content-start-attempt"><span>Start a new attempt</span></button></section>';
  const button = window.document.querySelector('button')!;
  const label = window.document.querySelector('span')!;
  let clicks = 0;
  button.addEventListener('click', () => {
    clicks++;
    button.parentElement!.removeAttribute('data-testid');
    button.parentElement!.remove();
  });
  const view = {
    evaluate: async (script: string) => window.eval(script),
    click: async () => {
      const event = new window.MouseEvent('click', {
        bubbles: true,
        composed: true,
      });
      Object.defineProperty(event, 'isTrusted', { value: true });
      label.dispatchEvent(event);
    },
  } as unknown as BunWebView;
  try {
    await nativeClick(
      view,
      '[data-testid="edition"] [data-testid="content-start-attempt"]',
      'primary',
      'click'
    );
    expect(clicks).toBe(1);
    expect(window.document.querySelector('section')).toBeNull();
  } finally {
    await window.happyDOM.close();
  }
});

test('a press still queued in a busy page is awaited, not sent a second time', async () => {
  // regression: browser-tap-resends-queued-press
  const window = new Window();
  window.document.body.innerHTML =
    '<button data-testid="content-draft-1">Draft</button>';
  let opened = 0;
  window.document.body
    .querySelector('button')!
    .addEventListener('click', () => {
      opened++;
      // The draft opens its author screen where the card was.
      window.document.body.innerHTML =
        '<section data-testid=""><h3>Draft details</h3></section>';
    });
  const trusted = (type: string) => {
    const event = new window.MouseEvent(type, {
      bubbles: true,
      composed: true,
    });
    Object.defineProperty(event, 'isTrusted', { value: true });
    return event;
  };
  let sends = 0;
  const view = {
    evaluate: async (script: string) => window.eval(script),
    click: async () => {
      sends++;
      // The browser is busy: the press reaches the page after the resend pause.
      window.setTimeout(() => {
        const under = window.document.body.firstElementChild!;
        for (const type of [
          'pointerdown',
          'mousedown',
          'pointerup',
          'mouseup',
          'click',
        ])
          under.dispatchEvent(trusted(type));
      }, 150);
    },
  } as unknown as BunWebView;
  try {
    await nativeClick(
      view,
      '[data-testid="content-draft-1"]',
      'primary',
      'click'
    );
    expect(sends).toBe(1);
    expect(opened).toBe(1);
  } finally {
    await window.happyDOM.close();
  }
});
