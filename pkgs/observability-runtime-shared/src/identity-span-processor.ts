import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span as SdkSpan,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import type { IdentitySource } from '@pkgs/observability-root-shared/identity';
import { stampIdentity } from '@pkgs/observability-root-shared/identity';

export class IdentitySpanProcessor implements SpanProcessor {
  readonly #identity: IdentitySource;

  constructor(identity: IdentitySource) {
    this.#identity = identity;
  }

  onStart(span: SdkSpan, _parentContext: Context): void {
    stampIdentity(span, this.#identity());
  }

  onEnd(_span: ReadableSpan): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
