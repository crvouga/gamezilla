import { crashBrowser, isBrowser } from './crash-browser';
import { crashExpo, isExpoNative } from './crash-expo';
import { crashFallback } from './crash-fallback';
import { crashNode, isNode } from './crash-node';

export function crash(
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

  if (isExpoNative()) {
    crashExpo(message, context);
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
