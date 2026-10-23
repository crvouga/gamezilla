import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span as SdkSpan,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import type {
  IdentitySource,
  ObservabilityIdentity,
} from '@pkgs/observability-root-shared-ts/identity';
import { stampIdentity } from '@pkgs/observability-root-shared-ts/identity';
import type { IdentityScope } from '@pkgs/observability-root-shared-ts/identity-scope';
import { scopeOf } from '@pkgs/observability-root-shared-ts/identity-scope';

/**
 * Gives every span the identity of the work it belongs to: the process-wide
 * source (a browser has one person) and the ambient scope (a server handles
 * many people at once, so each request binds its own).
 */
export class IdentitySpanProcessor implements SpanProcessor {
  readonly #identity: IdentitySource | undefined;
  readonly #scopes = new WeakMap<object, IdentityScope>();

  constructor(identity?: IdentitySource) {
    this.#identity = identity;
  }

  onStart(span: SdkSpan, parentContext: Context): void {
    const fixed: ObservabilityIdentity = this.#identity?.() ?? {};
    stampIdentity(span, fixed);
    const scope = scopeOf(parentContext);
    if (scope === undefined) return;
    stampIdentity(span, scope.identity);
    scope.open.add(span);
    this.#scopes.set(span, scope);
  }

  onEnd(span: ReadableSpan): void {
    this.#scopes.get(span)?.open.delete(span as unknown as SdkSpan);
    this.#scopes.delete(span);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
