/**
 * Asserts that a condition is true. If false, logs details and crashes the process
 * (Node.js/server) or poisons the page (browser). Uses the `asserts` return type
 * for TypeScript type narrowing downstream.
 *
 * This is for **tiger-style programming**: fail fast and loudly. When an invariant
 * is violated, the program stops immediately rather than continuing in an invalid
 * state. Use for conditions that must never be false in correct code.
 *
 * @param condition - The condition to assert.
 * @param message   - Human-readable description of the invariant.
 * @param context   - Optional structured data for debugging (logged before crash).
 * @throws {{ __assertion_failure: true, message: string, context?: unknown }}
 */
export function assert(
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
): asserts condition {
  if (condition) return;

  log(message, context);

  if (isNode()) {
    crashNode(message, context);
    return;
  }

  if (isBrowser()) {
    crashBrowser(message, context);
    return;
  }

  crashFallback(message, context);
}

function log(message: string, context?: Record<string, unknown>) {
  console.error('[ASSERT]', message);
  if (context !== undefined) console.error('[CONTEXT]', context);
  console.error(new Error().stack);
}

function isNode() {
  return typeof process !== 'undefined' && typeof process.exit === 'function';
}

function isBrowser() {
  return typeof document !== 'undefined';
}

function crashNode(message: string, context?: Record<string, unknown>) {
  process.exit(1);
}

function crashBrowser(message: string, context?: Record<string, unknown>) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
`;
  overlay.innerHTML = `
  <div style="background:#fff;padding:2rem;border-radius:8px;max-width:480px;color:#c00;">
    <h2 style="margin:0 0 1rem">Assertion failed</h2>
    <p>${message}</p>
    <pre>${JSON.stringify(context, null, 2)}</pre>
    <button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1rem;cursor:pointer;">
      Reload
    </button>
  </div>
`;
  document.body.appendChild(overlay);
}

function crashFallback(message: string, context?: Record<string, unknown>) {
  throw { __assertion_failure: true, message, context };
}
