import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { installInteractionTiming } from '@pkgs/observability-root-client-ts/interaction-timing';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  currentCorrelation,
  deserializeTraceContext,
} from '@pkgs/observability-root-shared-ts/correlation';
import { addEvent, EVENT } from '@pkgs/observability-root-shared-ts/events';
import { recordStructuredError } from '@pkgs/observability-root-shared-ts/log';
import {
  recordException,
  startSpan,
  withSpan,
} from '@pkgs/observability-root-shared-ts/span';
import {
  clearPendingInteractionCorrelation,
  setInteractionRequestRunner,
  setPendingInteractionCorrelation,
} from '@pkgs/sync-engine-shared-ts/interaction-correlation';
import { recordRecentTraceId } from './browser-identity';

type InteractionOutcome = 'navigation' | 'mutation' | 'request' | 'no_op';

let flushTraces: (() => Promise<void>) | undefined;

/** The browser batch exporter. A crash must flush before the page goes away. */
export function setBrowserTraceFlush(flush: () => Promise<void>): void {
  flushTraces = flush;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function reportError(error: unknown, source: string): string | undefined {
  const exception = asError(error);
  const span = startSpan('client.error', {
    [ATTR.CODE_FILE_PATH]: 'libs/app-root-shared-ts/src/browser-boundaries.ts',
    [ATTR.CODE_FUNCTION_NAME]: source,
  });
  recordException(span, exception);
  recordStructuredError(
    exception,
    source,
    trace.setSpan(context.active(), span)
  );
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

/** `db.system.name` of the two local databases a browser can end up on. */
export const LOCAL_DATABASE = {
  /** SQLite in a worker, kept in the origin private file system. */
  worker: 'sqlite.opfs',
  /** The in-memory stand-in, on the main thread; nothing is kept. */
  memory: 'sqlite.memory',
} as const;

/** Time the awaited startup work, separately from the selected-backend report. */
export function traceLocalDatabaseWork<T>(
  name: 'db.connect' | 'db.migrate',
  work: () => Promise<T>
): Promise<T> {
  return withSpan(name, work, { [ATTR.DB_SYSTEM_NAME]: 'sqlite' });
}

/**
 * One `db.open` span saying which local database this page runs on. Landing
 * on the stand-in is an error carrying its cause: every local query then runs
 * on the main thread, which shows up as slow interactions everywhere.
 */
export function recordLocalDatabaseOpen(
  system: (typeof LOCAL_DATABASE)[keyof typeof LOCAL_DATABASE],
  failure?: unknown
): void {
  const span = startSpan('db.open', {
    [ATTR.DB_SYSTEM_NAME]: system,
    [ATTR.DB_OPERATION_NAME]: 'open',
    [ATTR.CODE_FILE_PATH]:
      'libs/app-root-client-ts/src/open-main-sql-client.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'openMainSqlClient',
  });
  if (failure !== undefined) {
    const cause = asError(failure);
    recordException(span, cause);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `local SQLite unavailable, running on an in-memory database on the main thread: ${cause.message}`,
    });
  }
  span.end();
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
        'libs/app-root-shared-ts/src/browser-boundaries.ts',
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
    [ATTR.CODE_FILE_PATH]: 'libs/app-root-shared-ts/src/browser-boundaries.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'recordRouteChange',
  });
  recordRecentTraceId(span.spanContext().traceId);
  addEvent(span, EVENT.ROUTE_CHANGED, {});
  span.end();
}

function interactionTargetName(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return stableTarget(target);
}

/** Install the browser error sinks, click breadcrumbs, and input timing. */
export function installBrowserObservabilityBoundaries(args: {
  readonly timeOriginMs: number;
}): () => void {
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
  const removeTiming = installInteractionTiming({
    timeOriginMs: args.timeOriginMs,
    targetName: interactionTargetName,
  });
  setInteractionRequestRunner((traceparent, run) => {
    const parent = deserializeTraceContext(traceparent);
    return parent === undefined ? run() : context.with(parent, run);
  });
  return () => {
    setInteractionRequestRunner(null);
    removeTiming();
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
