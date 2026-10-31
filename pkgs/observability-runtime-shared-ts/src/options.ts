import type { ContextManager } from '@opentelemetry/api';
import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { PushMetricExporter } from '@opentelemetry/sdk-metrics';
import type {
  IdGenerator,
  Sampler,
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { Attributes } from '@pkgs/observability-root-shared-ts/attributes';
import type { TelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import type { EventContract } from '@pkgs/observability-root-shared-ts/event-contract';
import type { IdentitySource } from '@pkgs/observability-root-shared-ts/identity';
import type {
  MeasurementTimers,
  SyncCohort,
} from '@pkgs/observability-root-shared-ts/metric-contract';
import type { AttributeRedactor } from '@pkgs/observability-root-shared-ts/redaction';

export type TelemetryOptions = {
  /** Injected monotonic elapsed-time source; never domain/wall timestamps. */
  readonly monotonicNow?: () => number;
  readonly performanceTimers?: MeasurementTimers;
  readonly syncCohort?: () => SyncCohort;
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
  /** Head-sampling policy. The default records even an unsampled incoming context. */
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
