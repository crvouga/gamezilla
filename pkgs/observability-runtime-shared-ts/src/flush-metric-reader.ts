import {
  MetricReader,
  type PushMetricExporter,
} from '@opentelemetry/sdk-metrics';

/** Worker-safe push reader: the host flushes via waitUntil, with no interval
 * surviving beyond an invocation. Node/browser use their SDK periodic reader. */
export class FlushMetricReader extends MetricReader {
  readonly #exporter: PushMetricExporter;

  constructor(exporter: PushMetricExporter) {
    super({
      ...(exporter.selectAggregationTemporality === undefined
        ? {}
        : {
            aggregationTemporalitySelector:
              exporter.selectAggregationTemporality.bind(exporter),
          }),
      ...(exporter.selectAggregation === undefined
        ? {}
        : {
            aggregationSelector: exporter.selectAggregation.bind(exporter),
          }),
    });
    this.#exporter = exporter;
  }

  protected async onForceFlush(): Promise<void> {
    const result = await this.collect();
    if (result.errors.length > 0) throw new Error('Metric collection failed');
    await new Promise<void>((resolve, reject) => {
      this.#exporter.export(result.resourceMetrics, (outcome) => {
        if (outcome.code === 0) resolve();
        else reject(new Error('Metric export failed'));
      });
    });
    // The callback acknowledged this invocation's export. A shared exporter
    // may also hold another invocation's I/O, which this request cannot join.
  }

  protected async onShutdown(): Promise<void> {
    await this.#exporter.shutdown();
  }
}
