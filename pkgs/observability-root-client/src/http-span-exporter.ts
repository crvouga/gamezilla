import { ExportResultCode } from '@opentelemetry/core';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import type { HttpClient } from '@pkgs/http-client-shared/types';

export function createHttpSpanExporter(args: {
  readonly url: string;
  readonly http: HttpClient;
}): SpanExporter {
  const active = new Set<AbortController>();
  let closed = false;
  return {
    export(spans: ReadableSpan[], callback) {
      const body = JsonTraceSerializer.serializeRequest(spans);
      if (closed || body === undefined) {
        callback({ code: ExportResultCode.FAILED });
        return;
      }
      const requestBody = new ArrayBuffer(body.byteLength);
      new Uint8Array(requestBody).set(body);
      const abort = new AbortController();
      active.add(abort);
      void args.http
        .fetch(args.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: requestBody,
          signal: abort.signal,
        })
        .then((response) => {
          callback({
            code: response.ok
              ? ExportResultCode.SUCCESS
              : ExportResultCode.FAILED,
          });
        })
        .catch((error: unknown) => {
          callback({
            code: ExportResultCode.FAILED,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        })
        .finally(() => active.delete(abort));
    },
    shutdown() {
      closed = true;
      for (const abort of [...active]) abort.abort();
      active.clear();
      return Promise.resolve();
    },
  };
}
