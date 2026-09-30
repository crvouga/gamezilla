export {
  type Context,
  context,
  type Link,
  propagation,
  ROOT_CONTEXT,
  type Span,
  type SpanContext,
  SpanKind,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
export type {
  Attributes,
  AttributeValue,
  AttrValue,
} from './attributes';
export { ALLOWED_ATTRIBUTE_KEYS, ATTR } from './attributes';
export { connectionAttributes } from './connection-place';
export {
  currentCorrelation,
  deserializeTraceContext,
  linkFromTraceparent,
  serializeTraceContext,
} from './correlation';
export {
  deploymentTelemetryEnvironment,
  type TelemetryEnvironment,
} from './deployment-environment';
export type { EventAttributes } from './events';
export { addEvent, EVENT, events } from './events';
export type { IdentitySource, ObservabilityIdentity } from './identity';
export { stampIdentity } from './identity';
export type { CorrelatedLogEvent, LogSeverity } from './log';
export { recordLogEvent } from './log';
export type {
  NarrateEvent,
  NarrateLink,
  NarrateOptions,
  NarrateSpan,
} from './narrate';
export { narrate } from './narrate';
export { otlpAuthorization } from './otlp-auth';
export type { AttributeRedactor } from './redaction';
export { allowlistedAttributes, createAllowlistRedactor } from './redaction';
export type {
  AsyncFlushScope,
  DisposableSpan,
  StartSpanOptions,
} from './span';
export { activeSpan, startFlushScope, startSpan, withSpan } from './span';
