/**
 * AWS SDK v3 request handler that sends every S3 call through an injected
 * {@link HttpClient} — the wall client in the Worker, a mockingbird S3 fetch
 * handler in tests / sims. Replaces the SDK's implicit global transport.
 */

import type { S3ClientConfig } from '@aws-sdk/client-s3';
import type { HttpClient } from '@pkgs/http-client';

type S3RequestHandler = Extract<
  NonNullable<S3ClientConfig['requestHandler']>,
  { handle: unknown }
>;

type SdkHttpRequest = {
  readonly method: string;
  readonly protocol: string;
  readonly hostname: string;
  readonly port?: number;
  readonly path: string;
  readonly query?: Record<string, string | readonly string[] | null>;
  readonly headers: Record<string, string>;
  readonly body?: BodyInit | null;
};

function requestUrl(request: SdkHttpRequest): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value === null) params.append(key, '');
    else if (typeof value === 'string') params.append(key, value);
    else for (const item of value) params.append(key, item);
  }
  // S3 SigV4 signs `%20`, never `+`.
  const query = params.toString().replace(/\+/g, '%20');
  const port = request.port === undefined ? '' : `:${String(request.port)}`;
  const base = `${request.protocol}//${request.hostname}${port}${request.path}`;
  return query.length > 0 ? `${base}?${query}` : base;
}

function emptyBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({ start: (controller) => controller.close() });
}

export function createFetchRequestHandler(http: HttpClient): S3RequestHandler {
  const handler = {
    async handle(request: SdkHttpRequest) {
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
      const response = await http.fetch(requestUrl(request), {
        method: request.method,
        headers: request.headers,
        ...(hasBody && request.body != null ? { body: request.body } : {}),
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        response: {
          statusCode: response.status,
          reason: response.statusText,
          headers,
          body: response.body ?? emptyBody(),
        },
      };
    },
    updateHttpClientConfig: () => {},
    httpHandlerConfigs: () => ({}),
  };
  return handler as unknown as S3RequestHandler;
}
