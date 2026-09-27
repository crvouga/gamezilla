/** @jsxImportSource solid-js */
/**
 * Last-resort boundary outside feature providers so a startup render throw
 * (e.g. a provider that asserts on config) renders a readable error instead
 * of a blank screen. Plain DOM + `styles/base.css` `.crash-*` classes so it
 * never depends on the (possibly-crashing) theme / provider stack. Sits under
 * `ClientEnvProvider` so the copy button can use the injected timers.
 */

import { useTimers } from '@pkgs/clock/solid';
import {
  createSignal,
  ErrorBoundary,
  type JSX,
  onMount,
  Show,
  untrack,
} from 'solid-js';

import { reloadApp } from './boot/reload-app';

const CRASH_TITLE = 'App crashed!';
const COPIED_RESET_MS = 2000;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function formatCrashText(error: Error): string {
  const message = crashMessage(error);
  const stack = error.stack ?? '';
  return stack.length > 0
    ? `${CRASH_TITLE}\n\n${message}\n\n${stack}`
    : `${CRASH_TITLE}\n\n${message}`;
}

function crashMessage(error: Error): string {
  const message = error.message.trim();
  return message.length > 0 ? message : String(error);
}

function writeClipboard(text: string): Promise<void> {
  const clipboard = (
    globalThis as {
      navigator?: { clipboard?: { writeText(t: string): Promise<void> } };
    }
  ).navigator?.clipboard;
  if (clipboard === undefined) return Promise.resolve();
  return clipboard.writeText(text);
}

function CopyErrorButton(props: { readonly error: Error }): JSX.Element {
  const timers = useTimers();
  const [copied, setCopied] = createSignal(false);
  return (
    <button
      type="button"
      class="crash-copy"
      aria-label="Copy error"
      onClick={() => {
        void writeClipboard(formatCrashText(props.error)).then(() => {
          setCopied(true);
          timers.setTimeout(() => setCopied(false), COPIED_RESET_MS);
        });
      }}
    >
      {copied() ? 'Copied' : 'Copy error'}
    </button>
  );
}

function CrashScreen(props: {
  readonly error: Error;
  readonly reset: () => void;
}): JSX.Element {
  const [traceId, setTraceId] = createSignal<string>();
  onMount(() => {
    const error = untrack(() => props.error);
    void import('./observability/browser-boundaries').then(
      ({ reportSolidBoundaryError }) => {
        setTraceId(reportSolidBoundaryError(error));
      }
    );
  });
  return (
    <div class="crash-root" role="alert" data-component="RootErrorBoundary">
      <h1 class="crash-title">{CRASH_TITLE}</h1>
      <pre class="crash-message">{crashMessage(props.error)}</pre>
      <Show when={traceId()}>
        {(traceId) => <p class="crash-message">Trace: {traceId()}</p>}
      </Show>
      <div class="crash-actions">
        <CopyErrorButton error={props.error} />
        <button type="button" class="crash-copy" onClick={() => props.reset()}>
          Try again
        </button>
        <button type="button" class="crash-copy" onClick={() => reloadApp()}>
          Reload app
        </button>
      </div>
    </div>
  );
}

export function RootErrorBoundary(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <ErrorBoundary
      fallback={(error: unknown, reset) => {
        const normalized = toError(error);
        return <CrashScreen error={normalized} reset={reset} />;
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}
