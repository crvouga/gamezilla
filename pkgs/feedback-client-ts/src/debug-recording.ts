import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { DebugBuffer } from '@pkgs/feedback-shared-ts/debug-buffer';

const CONTROL =
  'button, a, summary, select, input, textarea, [contenteditable], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"]';
/** The bug report itself, and anything an app marks private, is never recorded. */
const PRIVATE = '[data-feedback-root], [data-feedback-private]';
const PRESSED_INPUT = /^(button|submit|reset|checkbox|radio)$/;

/** A control a person writes into: only that it was chosen is ever recorded. */
function typedInto(control: Element): boolean {
  if (control.matches('textarea, select, [contenteditable]')) return true;
  return (
    control.matches('input') &&
    !PRESSED_INPUT.test(control.getAttribute('type') ?? 'text')
  );
}

/** What a person chose, by the name the app gave it — never by what they wrote. */
export function choiceText(target: EventTarget | null): string | null {
  if (!(target instanceof Element) || target.closest(PRIVATE)) return null;
  const control = target.closest(CONTROL);
  if (!control) return null;
  const testId = control.getAttribute('data-testid');
  const mark = testId ? ` [${testId}]` : '';
  const named = control.getAttribute('aria-label')?.trim();
  if (typedInto(control))
    return `Chose a field${named ? ` "${named}"` : ''}${mark}`;
  const label = (
    named === undefined || named === '' ? control.textContent : named
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `Chose "${label}"${mark}`;
}

export function troubleText(trouble: unknown): string {
  if (trouble instanceof Error)
    return `${trouble.name}: ${trouble.message}\n${trouble.stack ?? ''}`.trim();
  if (typeof trouble === 'string') return trouble;
  try {
    // Undefined for a value JSON has no word for, whatever the types say.
    const text = JSON.stringify(trouble) as string | undefined;
    return text ?? String(trouble);
  } catch {
    return String(trouble);
  }
}

const TRACE = /^[0-9a-f]{2}-([0-9a-f]{32})-/;

/** A request by its method and address, without what follows a ? or #. */
function requestLabel(
  window: Window,
  input: RequestInfo | URL,
  init: RequestInit | undefined
): string {
  const request = typeof input === 'object' && 'url' in input ? input : null;
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const address =
    request?.url ?? (typeof input === 'string' ? input : (input as URL).href);
  try {
    const url = new URL(address, window.location.href);
    return `${method} ${url.origin}${url.pathname}`;
  } catch {
    return `${method} an address that could not be read`;
  }
}

/**
 * Records every request the app made that failed, and the server's trace of
 * it when the server names one. A request repeated with the same outcome is
 * recorded once, so retrying while offline cannot crowd out what came before.
 */
function recordFailedRequests(window: Window, debug: DebugBuffer): () => void {
  const original = window.fetch;
  let last = '';
  const failed = (text: string): void => {
    if (text === last) return;
    last = text;
    debug.record('trouble', text);
  };
  const recording: typeof window.fetch = async (input, init) => {
    const label = requestLabel(window, input, init);
    try {
      const response = await original.call(window, input, init);
      if (!response.ok) {
        const trace = TRACE.exec(response.headers.get('traceparent') ?? '');
        failed(
          `Request failed: ${label} answered ${response.status}${trace ? ` (trace ${trace[1]})` : ''}`
        );
      }
      return response;
    } catch (error) {
      // A request the app itself gave up on is not trouble.
      if (!(error instanceof Error && error.name === 'AbortError'))
        failed(
          `Request failed: ${label} never answered (${troubleText(error).split('\n')[0]})`
        );
      throw error;
    }
  };
  window.fetch = recording;
  return () => {
    if (window.fetch === recording) window.fetch = original;
  };
}

/** Records what the app itself reported as an error, alongside what it threw. */
function recordReportedErrors(window: Window, debug: DebugBuffer): () => void {
  const console = (window as Window & { console: Console }).console;
  const original = console.error;
  const recording = (...parts: unknown[]): void => {
    debug.record(
      'trouble',
      `Error reported: ${parts.map(troubleText).join(' ')}`
    );
    original.apply(console, parts);
  };
  console.error = recording;
  return () => {
    if (console.error === recording) console.error = original;
  };
}

type Recording = {
  readonly window: Window;
  readonly document: Document;
  readonly debug: DebugBuffer;
  readonly timers: Timers;
  /** An event the app raises on its document when it catches its own failure. */
  readonly applicationErrorEvent?: string;
  /** Called when the debug info is worth keeping for the next visit. */
  readonly onKeep?: () => void;
};

function listeners(options: Recording): [EventTarget, string, EventListener][] {
  const { window, document, debug } = options;
  // Only the path: what follows a ? or # can carry sign-in secrets.
  let path = window.location.pathname;
  debug.record('navigation', `Opened the app at ${path}`);
  const moved = (): void => {
    if (window.location.pathname === path) return;
    path = window.location.pathname;
    debug.record('navigation', `Went to ${path}`);
  };
  const trouble = (text: string): void => {
    moved();
    debug.record('trouble', text);
    options.onKeep?.();
  };
  return [
    [
      document,
      'click',
      (event) => {
        moved();
        const text = choiceText(event.target);
        if (text) debug.record('choice', text);
        // Where a choice leads is known only once the app has acted on it.
        options.timers.setTimeout(moved, 0);
      },
    ],
    [window, 'popstate', moved],
    [window, 'hashchange', moved],
    [
      window,
      'error',
      (event) =>
        trouble(
          troubleText(
            (event as ErrorEvent).error ?? (event as ErrorEvent).message
          )
        ),
    ],
    [
      window,
      'unhandledrejection',
      (event) => trouble(troubleText((event as PromiseRejectionEvent).reason)),
    ],
    [window, 'offline', () => debug.record('connection', 'Went offline')],
    [window, 'online', () => debug.record('connection', 'Came back online')],
    [
      document,
      'visibilitychange',
      () => {
        const hidden = document.visibilityState === 'hidden';
        debug.record(
          'navigation',
          hidden ? 'Left the app' : 'Came back to the app'
        );
        if (hidden) options.onKeep?.();
      },
    ],
    ...(options.applicationErrorEvent
      ? [
          [
            document,
            options.applicationErrorEvent,
            (event: Event) =>
              trouble(troubleText((event as CustomEvent<unknown>).detail)),
          ] as [EventTarget, string, EventListener],
        ]
      : []),
  ];
}

/**
 * Keeps debug info all the time, whether or not a bug is ever reported:
 * where the person went, what they chose, trouble the app ran into (errors
 * it threw or reported, and requests that failed), and the connection coming
 * and going. What a person types is never listened to.
 */
export function installDebugRecording(options: Recording): () => void {
  const installed = listeners(options);
  for (const [target, type, listener] of installed)
    target.addEventListener(type, listener, true);
  const restore = [
    recordFailedRequests(options.window, options.debug),
    recordReportedErrors(options.window, options.debug),
  ];
  return () => {
    for (const [target, type, listener] of installed)
      target.removeEventListener(type, listener, true);
    for (const undo of restore) undo();
  };
}
