import { expect, test } from 'bun:test';
import { createHttpSpanExporter } from '@pkgs/observability-root-client-ts/http-span-exporter';

test.each([200, 503])(
  'browser span export cancels HTTP %i before completion',
  async (status) => {
    // regression: worker-http-response-body-leak
    let canceled = false;
    const exporter = createHttpSpanExporter({
      url: 'https://collector.example/v1/traces',
      http: {
        fetch: async () =>
          new Response(
            new ReadableStream({
              cancel() {
                canceled = true;
              },
            }),
            { status }
          ),
      },
    });
    const outcome = await new Promise<{ code: number }>((resolve) =>
      exporter.export([], resolve)
    );
    expect(outcome.code).toBe(status === 200 ? 0 : 1);
    expect(canceled).toBe(true);
    await exporter.shutdown();
  }
);
