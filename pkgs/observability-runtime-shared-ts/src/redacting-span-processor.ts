import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span as SdkSpan,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import type { AttributeRedactor } from '@pkgs/observability-root-shared-ts/redaction';

export class RedactingSpanProcessor implements SpanProcessor {
  readonly #redact: AttributeRedactor;

  constructor(redact: AttributeRedactor) {
    this.#redact = redact;
  }

  onStart(_span: SdkSpan, _parentContext: Context): void {}

  onEnding(span: SdkSpan): void {
    if (span.status.message !== undefined) {
      const message = this.#redact(ATTR.EXCEPTION_MESSAGE, span.status.message);
      span.setStatus({
        code: span.status.code,
        ...(typeof message === 'string' ? { message } : { message: '' }),
      });
    }
    redactRecord(span.attributes, this.#redact);
    for (const event of span.events)
      redactRecord(event.attributes, this.#redact);
    for (const link of span.links) redactRecord(link.attributes, this.#redact);
  }

  onEnd(_span: ReadableSpan): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

function redactRecord(
  attributes: Record<string, unknown> | undefined,
  redact: AttributeRedactor
): void {
  if (attributes === undefined) return;
  for (const [key, value] of Object.entries(attributes)) {
    const replacement = redact(key, value as never);
    if (replacement === undefined) delete attributes[key];
    else attributes[key] = replacement;
  }
}
