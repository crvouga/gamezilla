import type { ContextManager } from '@opentelemetry/api';
import type {
  IdGenerator,
  Sampler,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import type { Attributes } from '../core/attributes';
import type { TelemetryEnvironment } from '../core/deployment-environment';
import type { IdentitySource } from '../core/identity';
import type { AttributeRedactor } from '../core/redaction';

export type TelemetryOptions = {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: TelemetryEnvironment;
  readonly buildSha: string;
  readonly exporter?: SpanExporter;
  /** Exact OTLP/HTTP trace endpoint, including `/v1/traces`. */
  readonly otlpUrl?: string;
  readonly otlpHeaders?: Record<string, string>;
  readonly identity?: IdentitySource;
  readonly redact?: AttributeRedactor;
  readonly resourceAttributes?: Attributes;
  readonly spanProcessors?: readonly SpanProcessor[];
  /** Head-sampling policy. Omitted means the SDK's always-on default. */
  readonly sampler?: Sampler;
  /** Standard OTel ID generator. Useful for deterministic test artifacts. */
  readonly idGenerator?: IdGenerator;
  readonly contextManager?: ContextManager;
  readonly registerGlobal?: boolean;
};

export type TelemetryRuntime = {
  readonly forceFlush: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
};
