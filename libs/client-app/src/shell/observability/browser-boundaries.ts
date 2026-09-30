import {
  ATTR,
  addEvent,
  context,
  currentCorrelation,
  deserializeTraceContext,
  EVENT,
  SpanStatusCode,
  startSpan,
} from '@pkgs/observability/core';
import {
  clearPendingInteractionCorrelation,
  setInteractionRequestRunner,
  setPendingInteractionCorrelation,
} from '@pkgs/sync-engine/client';
import { recordRecentTraceId } from './browser-identity';

type InteractionOutcome = 'navigation' | 'mutation' | 'request' | 'no_op';

let flushTraces: (() => Promise<void>) | undefined;

/** The browser batch exporter. A crash must flush before the page goes away. */
export function setBrowserTraceFlush(flush: () => Promise<void>): void {
  flushTraces = flush;
}

function reportError(error: unknown, source: string): string | undefined {
  const exception = error instanceof Error ? error : new Error(String(error));
  const span = startSpan('client.error', {
    [ATTR.CODE_FILE_PATH]:
      'libs/client-app/src/shell/observability/browser-boundaries.ts',
    [ATTR.CODE_FUNCTION_NAME]: source,
  });
  span.recordException(exception);
  span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
  const traceId = span.spanContext().traceId;
  recordRecentTraceId(traceId);
  span.setAttribute(ATTR.APP_ERROR_TRACE_ID, traceId);
  span.end();
  const pending = flushTraces?.();
  if (pending !== undefined)
    void pending.then(
      () => undefined,
      () => undefined
    );
  return traceId;
}

export function reportSolidBoundaryError(error: unknown): string | undefined {
  return reportError(error, 'RootErrorBoundary');
}

function isMeaningfulTarget(target: EventTarget | null): target is Element {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      'button,a,input,select,textarea,form,[role],[data-component],[data-screen]'
    ) !== null
  );
}

function stableTarget(target: Element): string {
  const element = target.closest(
    '[data-screen],[data-component],[role],button,a,input,select,textarea,form'
  );
  if (element === null) return target.tagName.toLowerCase();
  const screen = element.getAttribute('data-screen');
  if (screen !== null) return `screen:${screen}`;
  const component = element.getAttribute('data-component');
  if (component !== null) return `component:${component}`;
  const role = element.getAttribute('role');
  return role === null
    ? `element:${element.tagName.toLowerCase()}`
    : `role:${role}`;
}

function traceparentFor(
  span: ReturnType<typeof startSpan>
): string | undefined {
  const ctx = span.spanContext();
  if (!ctx.isRemote && /^0+$/.test(ctx.traceId)) return undefined;
  const flags = (ctx.traceFlags & 1).toString(16).padStart(2, '0');
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

function startInteraction(event: Event): void {
  if (!isMeaningfulTarget(event.target)) return;
  const before = `${location.pathname}${location.search}${location.hash}`;
  const isSubmit = event.type === 'submit';
  const span = startSpan(
    isSubmit ? 'interaction.submit' : 'interaction.click',
    {
      [ATTR.APP_INTERACTION_TYPE]: isSubmit ? 'submit' : 'click',
      [ATTR.APP_INTERACTION_TARGET]: stableTarget(event.target),
      [ATTR.CODE_FILE_PATH]:
        'libs/client-app/src/shell/observability/browser-boundaries.ts',
      [ATTR.CODE_FUNCTION_NAME]: 'startInteraction',
    }
  );
  recordRecentTraceId(span.spanContext().traceId);
  let outcome: InteractionOutcome = 'no_op';
  const traceparent = traceparentFor(span);
  if (traceparent !== undefined) {
    setPendingInteractionCorrelation({
      traceparent,
      markOutcome: (next) => {
        outcome = next;
      },
    });
  }
  addEvent(
    span,
    isSubmit ? EVENT.INTERACTION_SUBMITTED : EVENT.INTERACTION_CLICKED,
    {}
  );
  queueMicrotask(() => {
    const after = `${location.pathname}${location.search}${location.hash}`;
    if (after !== before) outcome = 'navigation';
    span.setAttribute(ATTR.APP_INTERACTION_OUTCOME, outcome);
    if (traceparent !== undefined) {
      clearPendingInteractionCorrelation(traceparent);
    }
    span.end();
  });
}

function recordRouteChange(): void {
  const span = startSpan('route.change', {
    [ATTR.APP_INTERACTION_TYPE]: 'route',
    [ATTR.APP_INTERACTION_TARGET]: 'window:history',
    [ATTR.APP_INTERACTION_OUTCOME]: 'navigation',
    [ATTR.CODE_FILE_PATH]:
      'libs/client-app/src/shell/observability/browser-boundaries.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'recordRouteChange',
  });
  recordRecentTraceId(span.spanContext().traceId);
  addEvent(span, EVENT.ROUTE_CHANGED, {});
  span.end();
}

/** Install the three browser-global error sinks and delegated breadcrumbs. */
export function installBrowserObservabilityBoundaries(): () => void {
  const onError = (event: ErrorEvent) => {
    reportError(event.error ?? event.message, 'window.onerror');
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason, 'window.unhandledrejection');
  };
  document.addEventListener('click', startInteraction, true);
  document.addEventListener('submit', startInteraction, true);
  window.addEventListener('popstate', recordRouteChange);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  setInteractionRequestRunner((traceparent, run) => {
    const parent = deserializeTraceContext(traceparent);
    return parent === undefined ? run() : context.with(parent, run);
  });
  return () => {
    setInteractionRequestRunner(null);
    document.removeEventListener('click', startInteraction, true);
    document.removeEventListener('submit', startInteraction, true);
    window.removeEventListener('popstate', recordRouteChange);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}

export function currentBrowserTraceId(): string | undefined {
  return currentCorrelation().traceId;
}
