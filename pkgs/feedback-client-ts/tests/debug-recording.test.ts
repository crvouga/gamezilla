import { afterEach, describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createDebugBuffer } from '@pkgs/feedback-shared-ts/debug-buffer';
import { installDebugRecording, troubleText } from '../src/debug-recording';

let stop: () => void = () => undefined;

function record(html: string) {
  document.body.innerHTML = html;
  const { clock, timers } = createHarnessClock();
  const debug = createDebugBuffer({ clock });
  let kept = 0;
  stop = installDebugRecording({
    window,
    document,
    debug,
    timers,
    applicationErrorEvent: 'product-crash',
    onKeep: () => kept++,
  });
  const press = (selector: string): void => {
    document
      .querySelector(selector)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
  const texts = (): string[] =>
    debug
      .snapshot()
      .slice(1)
      .map((event) => `${event.kind}: ${event.text}`);
  return { press, texts, kept: () => kept };
}

afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

describe('debug info', () => {
  test('records what a person chose by its name', () => {
    const app = record(
      '<button data-testid="resign"><span>Resign</span> game</button>' +
        '<button aria-label="Close menu">×</button><p id="text">Words</p>'
    );
    app.press('span');
    app.press('[aria-label]');
    app.press('#text');
    expect(app.texts()).toEqual([
      'choice: Chose "Resign game" [resign]',
      'choice: Chose "Close menu"',
    ]);
  });

  test('never records what a person typed', () => {
    const app = record(
      '<input aria-label="Card number" value="4242 4242" />' +
        '<textarea>my secret</textarea><div contenteditable>dear diary</div>' +
        '<select><option>Private choice</option></select>'
    );
    const field = document.querySelector('input') as HTMLInputElement;
    app.press('input');
    field.value = '4242 4242 4242 4242';
    for (const type of ['keydown', 'input', 'keyup', 'change'])
      field.dispatchEvent(new Event(type, { bubbles: true }));
    app.press('textarea');
    app.press('[contenteditable]');
    app.press('select');
    expect(app.texts()).toEqual([
      'choice: Chose a field "Card number"',
      'choice: Chose a field',
      'choice: Chose a field',
      'choice: Chose a field',
    ]);
  });

  test('records nothing inside the bug report or a private part of the app', () => {
    const app = record(
      '<div data-feedback-root><button>Send</button></div>' +
        '<div data-feedback-private><button id="pay">Pay Alice</button></div>'
    );
    app.press('button');
    app.press('#pay');
    expect(app.texts()).toEqual([]);
  });

  test('records trouble the app caught itself, and keeps it for next time', () => {
    const app = record('');
    document.dispatchEvent(
      new CustomEvent('product-crash', { detail: new RangeError('No moves') })
    );
    expect(app.texts()[0]).toStartWith('trouble: RangeError: No moves');
    expect(app.kept()).toBe(1);
  });

  test('records a request that failed, without what follows its ?', async () => {
    const before = window.fetch;
    window.fetch = (() =>
      Promise.resolve(
        new Response('no', {
          status: 500,
          headers: {
            traceparent:
              '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
          },
        })
      )) as unknown as typeof window.fetch;
    try {
      const app = record('');
      await window.fetch('https://api.example/games/7?token=secret', {
        method: 'post',
      });
      await window.fetch('https://api.example/games/7?token=secret', {
        method: 'post',
      });
      expect(app.texts()).toEqual([
        'trouble: Request failed: POST https://api.example/games/7 answered 500 (trace 4bf92f3577b34da6a3ce929d0e0e4736)',
      ]);
      stop();
    } finally {
      window.fetch = before;
    }
  });

  test('records a request that never answered, but not one the app gave up on', async () => {
    const before = window.fetch;
    const outcomes = [
      new TypeError('Failed to fetch'),
      new DOMException('Gave up', 'AbortError'),
    ];
    window.fetch = (() =>
      Promise.reject(outcomes.shift())) as unknown as typeof window.fetch;
    try {
      const app = record('');
      await window.fetch('/api/sync').catch(() => undefined);
      await window.fetch('/api/sync').catch(() => undefined);
      expect(app.texts()).toEqual([
        `trouble: Request failed: GET ${window.location.origin}/api/sync never answered (TypeError: Failed to fetch)`,
      ]);
      stop();
    } finally {
      window.fetch = before;
    }
  });

  test('records an error the app reported itself', () => {
    const before = console.error;
    console.error = () => undefined;
    try {
      const app = record('');
      console.error('sync refused', new Error('No lease'));
      expect(app.texts()[0]).toStartWith(
        'trouble: Error reported: sync refused Error: No lease'
      );
      stop();
    } finally {
      console.error = before;
    }
  });

  test('stops recording once uninstalled', () => {
    const app = record('<button>Play</button>');
    stop();
    app.press('button');
    expect(app.texts()).toEqual([]);
  });

  test('puts any trouble into words', () => {
    expect(troubleText('plain')).toBe('plain');
    expect(troubleText({ code: 7 })).toBe('{"code":7}');
    expect(troubleText(undefined)).toBe('undefined');
    const loop: { self?: unknown } = {};
    loop.self = loop;
    expect(troubleText(loop)).toBe('[object Object]');
  });
});
