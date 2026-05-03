/// <reference lib="dom" />
import type { CrashHandler } from './crash-handler';
import { CRASH_OVERLAY_STYLES } from './crash-handler-browser-styles';

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
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
    <button class="assert-btn assert-btn-primary" onclick="location.reload()">Reload</button>
    <span class="assert-suppressed" id="${SUPPRESSED_EL_ID}" style="${suppressedDisplay}">+${suppressedCount} more</span>
  </div>
</div>`;
}

function crashBrowser(message: string, context?: Record<string, unknown>) {
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
  document.body.appendChild(overlay);
}

export class BrowserCrashHandler implements CrashHandler {
  readonly priority: number = 10;
  match(): boolean {
    return isBrowser();
  }
  crash(message: string, context?: Record<string, unknown>): void {
    crashBrowser(message, context);
  }
}
