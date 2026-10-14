# Observability contracts

Tracing continues through the existing `span`, `events`, `correlation` and
`attributes` modules. Named business events use OpenTelemetry log records;
they are independent of head sampling. Runtime adapters accept explicit
`logsUrl` and `metricsUrl` or injected SDK exporters. A traces endpoint does
not imply support for the other signals.

## Declare and emit an event

```ts
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import { emitBusinessEvent } from '@pkgs/observability-root-shared/business-event';

export const completed = defineEvent({
  name: 'example.operation.completed',
  version: 1,
  owner: 'example',
  description: 'An operation reached its completed state.',
  delivery: 'best_effort',
  attributes: {
    'operation.id': { type: 'string', required: true },
    'operation.duration_ms': { type: 'number', required: true, minimum: 0 },
  },
});

emitBusinessEvent(completed, {
  'operation.id': operationId,
  'operation.duration_ms': durationMs,
}, { id: operationId, occurredAtMs: clock.now(), synthetic: isSynthetic });
```

Register contracts in the runtime's `eventContracts`. Unregistered named
records are dropped by the log exporter guard. Undeclared attributes,
sensitive attribute names, invalid types, nonfinite measurements, negative
bounded values, email-shaped identifiers and credential-bearing values fail
validation. The boolean return from `emitBusinessEvent` means the API call
accepted a valid record; it is **not** an ingestion acknowledgement. It can
return true with a no-op global provider. It must not gate a business outcome.

## Reliable events

Use `createEventOutbox(contract)` and call `enqueue` inside the same SQL
transaction as the domain change. Supply the original event time and a stable
logical ID, never a fresh delivery ID. Pass the serialized originating
traceparent when available. Register `createEventDelivery` from the server
package against the returned message tag and an injected `LogRecordExporter`.

The existing outbox stores the event, deduplicates the versioned key and owns
bounded retries. Delivery completes only after a successful exporter callback.
Exporter failures do not undo an already committed business operation. The
existing outbox's exhausted deliveries need operational reconciliation; there
is no new automatic dead-letter replay mechanism here. At-least-once export
can create physical duplicates after an acknowledgement or transaction is
lost. Deduplicate by `(event name, event.version, event.id)` in queries. Never
reuse this identity for different facts. Financial and security source records
remain authoritative regardless of telemetry delivery.

## Compatibility, metrics and reporting

Use `eventCompatibilityErrors` against a checked-in previous contract in the
owning package's tests. Breaking schemas require an increased version; keep
old version consumers registered until their pending deliveries are drained.
This API does not automatically discover a repository-wide schema baseline.

`createMetric` accepts approved dimension names with finite vocabularies.
Unknown values, extra dimensions, negative/nonfinite measurements and more
than 256 vocabulary combinations are rejected. SDK views enforce the same
dimension allowlist and a series cap. Identifiers stay out of metrics.

`logicalEvents` deduplicates records, rejects conflicting copies, includes only explicitly real activity, excludes unknown and
synthetic activity and selects event time in explicit half-open UTC windows.
`activeSubjects` requires a caller-supplied meaningful-action vocabulary and
an erasure set. Page views are not implicitly active use. These helpers do not
implement an identity-link graph, consent storage, cohorts or an event store.

## Runtime and privacy limits

Browser and Node signals batch through the official SDK. Workers use injected
HTTP and timers for bounded OTLP acknowledgements and flush metrics at
invocation boundaries instead of scheduling an interval. `flushWith` hands all
signals to `waitUntil` and exposes rejected exports. Production keeps that work
outside the response; standard deployments join it and fail loudly. Every host
must still arrange shutdown/flush; telemetry is best effort outside the outbox.
Response ownership checks are described in the repository's
[correctness machinery](../../README.md#correctness-machinery).

Generic log bodies are replaced with stable names and instrumentation-scope
attributes are removed before export. Diagnostic attributes use the existing default-deny redactor. Named
events must match their registered schema and envelope. Credentials and email
addresses in span status descriptions now follow exception redaction as well.
Free text still requires deliberate review: an allowlist and pattern-based
redactor cannot prove that arbitrary text contains no personal information.
Session replay is not installed. This package does not implement consent,
retention, backend access control or subject erasure in an external backend.

Automated checks live in this package's `tests`, the server package's `tests`
and the sibling harness. Existing package `test`, `tc` and `lint` tasks include
them in full verification; no manual dashboard inspection provides evidence.
