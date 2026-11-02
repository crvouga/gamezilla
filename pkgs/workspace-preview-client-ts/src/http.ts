import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { browserPreviewRequest } from './url';

/** Decorate an injected port; the library never selects a wall HTTP client. */
export function browserPreviewHttp(http: HttpClient): HttpClient {
  return {
    fetch: (input, init) => {
      const target = browserPreviewRequest(input, init);
      return target instanceof Promise
        ? target.then((request) => http.fetch(request, init))
        : http.fetch(target, init);
    },
  };
}
