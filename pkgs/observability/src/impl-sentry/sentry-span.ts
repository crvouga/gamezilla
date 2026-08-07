import type {
  Span,
  SpanAttributes,
  SpanKind,
  SpanStatus,
} from '../shared/types';
import type { SentrySdk } from './sentry-sdk';
import { applySlowSpanAttributes } from './slow-span';

type SentrySpanType = Parameters<SentrySdk['spanToTraceHeader']>[0];

function mapKindToOp(kind: SpanKind, name: string): string {
  if (kind === 'server') return 'http.server';
  if (kind === 'client') return 'http.client';
  return name;
}

export class PortSentrySpan implements Span {
  readonly spanContext: Span['spanContext'];
  private readonly sentrySpan: SentrySpanType;
  private readonly spanName: string;
  private readonly startedAt = performance.now();
  private readonly onEnd: (() => void) | undefined;
  private ended = false;

  constructor(args: {
    sentrySpan: SentrySpanType;
    spanName: string;
    kind: SpanKind;
    sdk: SentrySdk;
    onEnd?: () => void;
  }) {
    this.sentrySpan = args.sentrySpan;
    this.spanName = args.spanName;
    this.onEnd = args.onEnd;
    const ctx = args.sdk.spanContext(args.sentrySpan);
    this.spanContext = {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      traceFlags: ctx.traceFlags & 0x1,
    };
    args.sentrySpan.setAttribute('span.kind', args.kind);
  }

  get underlyingSentrySpan(): SentrySpanType {
    return this.sentrySpan;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this.ended) return;
    try {
      this.sentrySpan.setAttribute(key, value);
    } catch {
      /* never throw into caller */
    }
  }

  addEvent(name: string, attributes?: SpanAttributes): void {
    if (this.ended) return;
    try {
      this.sentrySpan.addEvent(name, attributes);
    } catch {
      /* never throw into caller */
    }
  }

  setStatus(status: SpanStatus): void {
    if (this.ended) return;
    try {
      if (status.code === 'error') {
        this.sentrySpan.setStatus({
          code: 2,
          ...(status.message !== undefined ? { message: status.message } : {}),
        });
      } else {
        this.sentrySpan.setStatus({ code: 1 });
      }
    } catch {
      /* never throw into caller */
    }
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    const durationMs = performance.now() - this.startedAt;
    try {
      applySlowSpanAttributes({
        spanName: this.spanName,
        durationMs,
        setAttribute: (key, value) => this.setAttribute(key, value),
      });
      this.sentrySpan.end();
      this.onEnd?.();
    } catch {
      /* never throw into caller */
    }
  }
}

export function startPortSentrySpan(args: {
  sdk: SentrySdk;
  name: string;
  kind: SpanKind;
  attributes?: SpanAttributes;
  parentSentrySpan?: SentrySpanType;
  onEnd?: () => void;
}): PortSentrySpan {
  const sentrySpan = args.sdk.startInactiveSpan({
    name: args.name,
    op: mapKindToOp(args.kind, args.name),
    ...(args.attributes !== undefined ? { attributes: args.attributes } : {}),
    ...(args.parentSentrySpan !== undefined
      ? { parentSpan: args.parentSentrySpan }
      : {}),
  });
  return new PortSentrySpan({
    sdk: args.sdk,
    sentrySpan,
    spanName: args.name,
    kind: args.kind,
    ...(args.onEnd !== undefined ? { onEnd: args.onEnd } : {}),
  });
}

export function spanContextKey(context: Span['spanContext']): string {
  return `${context.traceId}:${context.spanId}`;
}
