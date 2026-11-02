import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { browserPreviewOrigin } from './browser-origin';
import { browserPreviewUrl, resolveBrowserPreviewRequest } from './url';

type PreviewHttpOptions = {
  readonly origin: string;
  readonly mapUrl: (url: string) => string;
};

export function createPreviewHttp(
  http: HttpClient,
  options: PreviewHttpOptions
): HttpClient {
  return {
    fetch: async (input, init) => {
      const target = await resolveBrowserPreviewRequest(
        input,
        options.mapUrl,
        init
      );
      const url = target instanceof Request ? target.url : String(target);
      if (new URL(url, options.origin).origin !== options.origin)
        return http.fetch(target, init);
      // The tunnel authenticates every subrequest, including otherwise anonymous
      // feedback and signed uploads. Keep its cookie on this origin only.
      const response = await http.fetch(target, {
        ...init,
        credentials: 'same-origin',
        redirect: 'manual',
      });
      if (response.type === 'opaqueredirect')
        throw new Error(
          'Preview session needs attention. Open the preview URL in a new tab, complete email sign-in, then retry here.'
        );
      return response;
    },
  };
}

/** Decorate an injected port; the library never selects a wall HTTP client. */
export function browserPreviewHttp(http: HttpClient): HttpClient {
  const origin = browserPreviewOrigin();
  return origin === null
    ? http
    : createPreviewHttp(http, { origin, mapUrl: browserPreviewUrl });
}
