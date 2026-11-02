import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/** Check access before evaluating modules that start native asset/worker loads. */
export async function loadPreviewApplication<T>(options: {
  readonly origin: string | null;
  readonly http: HttpClient;
  readonly load: () => Promise<T>;
}): Promise<T> {
  if (
    options.origin !== null &&
    new URL(options.origin).protocol === 'https:'
  ) {
    const response = await options.http.fetch(`${options.origin}/api/health`, {
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('application/json')
    )
      throw new Error(
        'Preview access could not be confirmed. Open the preview URL in a new tab, complete email sign-in, then reload.'
      );
  }
  return options.load();
}
