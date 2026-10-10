import type { ContextManager } from '@opentelemetry/api';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type {
  IdGenerator,
  Sampler,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { Attributes } from '@pkgs/observability-root-shared/attributes';
import type { TelemetryEnvironment } from '@pkgs/observability-root-shared/deployment-environment';
import type { EventContract } from '@pkgs/observability-root-shared/event-contract';
import type { IdentitySource } from '@pkgs/observability-root-shared/identity';
import type { AttributeRedactor } from '@pkgs/observability-root-shared/redaction';

export type TelemetryOptions = {
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly environment: TelemetryEnvironment;
  readonly buildSha: string;
  readonly instanceId?: string;
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
  /** Explicit signal endpoints: never infer logs/metrics support from a trace URL. */
  readonly logsUrl?: string;
  readonly metricsUrl?: string;
  readonly logExporter?: LogRecordExporter;
  readonly metricExporter?: PushMetricExporter;
  readonly eventContracts?: readonly EventContract[];
};

export type TelemetryRuntime = {
  readonly forceFlush: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
};
