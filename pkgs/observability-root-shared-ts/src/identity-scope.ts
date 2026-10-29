import {
  type Context,
  context,
  createContextKey,
  type Span,
  trace,
} from '@opentelemetry/api';

import type { ObservabilityIdentity } from './identity';
import { stampIdentity } from './identity';

const SCOPE = createContextKey('@pkgs/observability.identity-scope');

/**
 * Who the work in progress is for. A request learns that part-way through
 * (after it authenticates), so the scope is mutable: it stamps every span that
 * is already open and every span started afterwards.
 */
export type IdentityScope = {
  identity: ObservabilityIdentity;
  readonly open: Set<Span>;
};

/**
 * Opens an identity scope around `run`. Every span started inside carries the
 * identity bound by {@link bindIdentity}, wherever in the code it starts, so
 * instrumentation never stamps `user.id`, `session.id` or `app.device.id` by hand.
 * Nested calls join the scope already open.
 */
export function withIdentityScope<T>(run: () => T): T {
  if (scopeOf(context.active()) !== undefined) return run();
  const scope: IdentityScope = { identity: {}, open: new Set() };
  return context.with(context.active().setValue(SCOPE, scope), run);
}

/**
 * Records who the current work is for. Safe anywhere: outside a scope it stamps
 * only the active span.
 */
export function bindIdentity(identity: ObservabilityIdentity): void {
  const scope = scopeOf(context.active());
  const active = trace.getSpan(context.active());
  if (scope === undefined) {
    if (active !== undefined) stampIdentity(active, identity);
    return;
  }
  scope.identity = { ...scope.identity, ...identity };
  for (const span of scope.open) stampIdentity(span, identity);
  if (active !== undefined && !scope.open.has(active))
    stampIdentity(active, identity);
}

export function scopeOf(source: Context): IdentityScope | undefined {
  const value = source.getValue(SCOPE);
  return value === undefined ? undefined : (value as IdentityScope);
}
