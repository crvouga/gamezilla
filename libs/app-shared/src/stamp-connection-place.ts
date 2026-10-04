import type { Span } from '@opentelemetry/api';
import { connectionAttributes } from '@pkgs/observability-shared/connection-place';

/** Stamp where this connection appeared. Absent on runtimes without edge facts. */
export function stampConnectionPlace(span: Span, request: Request): void {
  const attributes = connectionAttributes(connectionFacts(request));
  for (const [key, value] of Object.entries(attributes)) {
    span.setAttribute(key, value);
  }
}

function connectionFacts(
  request: Request
): Readonly<Record<string, unknown>> | undefined {
  const candidate = (request as { readonly cf?: unknown }).cf;
  if (candidate === null || typeof candidate !== 'object') return undefined;
  return candidate as Readonly<Record<string, unknown>>;
}
