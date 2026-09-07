/// <reference lib="dom" />

import type { CrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler';
import type { Timers } from '@pkgs/clock';
import { CRASH_OVERLAY_STYLES } from './crash-handler-browser-styles';

function isBrowser() {
  // Some environments define window+document stubs; never treat them as a real
  // DOM browser — BrowserCrashHandler must not win over a platform handler.
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

let suppressedCount = 0;
const OVERLAY_ID = 'assert-crash-overlay';
const SUPPRESSED_EL_ID = 'assert-suppressed-count';

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function updateSuppressedCount() {
  const el = document.getElementById(SUPPRESSED_EL_ID);
  if (el === null) return;
  el.textContent = `+${suppressedCount} more`;
  (el as HTMLElement).style.display = suppressedCount > 0 ? '' : 'none';
}

function bumpSuppressed(): void {
  suppressedCount++;
  updateSuppressedCount();
}

function buildErrorText(message: string, contextJson: string): string {
  const body =
    contextJson.length > 0 ? `${message}\n\n${contextJson}` : message;
  return `Assertion failed: ${body}`;
}

async function copyErrorText(
  text: string,
  button: HTMLButtonElement,
  timers: Timers
) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy failed';
  }
  timers.setTimeout(() => {
    button.textContent = label;
  }, 1500);
}

function buildOverlayHtml(message: string, contextJson: string): string {
  const safeMessage = escapeHtml(message);
  const safeContext = escapeHtml(contextJson);
  const contextBlock =
    contextJson.length > 0
      ? `<pre class="assert-context">${safeContext}</pre>`
      : '';
  const suppressedDisplay = suppressedCount > 0 ? '' : 'display:none';
  return `
<style>${CRASH_OVERLAY_STYLES}</style>
<div class="assert-card">
  <div class="assert-header">
    <div class="assert-icon">!</div>
    <h2 class="assert-title">Assertion failed</h2>
  </div>
  <p class="assert-message">${safeMessage}</p>
  ${contextBlock}
  <div class="assert-actions">
    <button type="button" class="assert-btn assert-btn-primary" data-assert-action="reload">Reload</button>
    <button type="button" class="assert-btn assert-btn-secondary" data-assert-action="copy">Copy error</button>
    <span class="assert-suppressed" id="${SUPPRESSED_EL_ID}" style="${suppressedDisplay}">+${suppressedCount} more</span>
  </div>
</div>`;
}

function wireOverlayActions(
  overlay: HTMLElement,
  errorText: string,
  timers: Timers
) {
  const reload = overlay.querySelector('[data-assert-action="reload"]');
  if (reload instanceof HTMLButtonElement) {
    reload.addEventListener('click', () => {
      location.reload();
    });
  }
  const copy = overlay.querySelector('[data-assert-action="copy"]');
  if (copy instanceof HTMLButtonElement) {
    copy.addEventListener('click', () => {
      void copyErrorText(errorText, copy, timers);
    });
  }
}

function crashBrowser(
  message: string,
  timers: Timers,
  context?: Record<string, unknown>
) {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing !== null) {
    bumpSuppressed();
    return;
  }
  const contextJson =
    context !== undefined ? JSON.stringify(context, null, 2) : '';
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = buildOverlayHtml(message, contextJson);
  wireOverlayActions(overlay, buildErrorText(message, contextJson), timers);
  document.body.appendChild(overlay);
}

export class BrowserCrashHandler implements CrashHandler {
  readonly priority: number = 10;
  constructor(private readonly timers: Timers) {}
  match(): boolean {
    return isBrowser();
  }
  crash(message: string, context?: Record<string, unknown>): void {
    crashBrowser(message, this.timers, context);
  }
}
