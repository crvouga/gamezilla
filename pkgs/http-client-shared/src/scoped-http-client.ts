import { AsyncLocalStorage } from '@pkgs/async-local-shared/async-local-storage';
import { HttpResponseScope } from './response-scope';
import type { HttpClient } from './types';

/** Scope isolation works for overlapping requests, including their waitUntil work. */
export function createScopedHttpClient(inner: HttpClient) {
  const active = new AsyncLocalStorage<HttpResponseScope>();
  return {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      return (active.getStore() ?? inner).fetch(input, init);
    },
    async run<T>(operation: () => Promise<T>): Promise<T> {
      const scope = new HttpResponseScope(inner);
      return active.run(scope, async () => {
        let result: T | undefined;
        try {
          result = await operation();
          return result;
        } finally {
          await scope.finish(result instanceof Response ? result : undefined);
        }
      });
    },
  };
}
