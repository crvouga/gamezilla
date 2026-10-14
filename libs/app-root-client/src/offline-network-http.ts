import { trackAbortableResponse } from '@pkgs/http-client-shared/abortable-response';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import type { OfflineNetworkController } from './offline-network-controller';

export const VOLUNTARY_OFFLINE_MESSAGE =
  'This app is working offline. Work online to use a connection.';

export function offlineNetworkError(): HttpNetworkError {
  return new HttpNetworkError(VOLUNTARY_OFFLINE_MESSAGE);
}

function requestSignal(
  input: RequestInfo | URL,
  init?: RequestInit
): AbortSignal | null {
  if (init?.signal !== undefined && init.signal !== null) return init.signal;
  return input instanceof Request ? input.signal : null;
}

/** HTTP gate that also aborts every request already in flight when closed. */
export function createOfflineHttp(
  offline: OfflineNetworkController,
  inner: HttpFetch
): HttpFetch {
  const active = new Set<AbortController>();
  offline.subscribe((closed) => {
    if (!closed) return;
    for (const controller of [...active]) controller.abort();
    active.clear();
  });
  return async (input, init) => {
    if (offline.isOffline()) throw offlineNetworkError();
    const controller = new AbortController();
    const callerSignal = requestSignal(input, init);
    const abort = (): void => controller.abort();
    if (callerSignal?.aborted === true) controller.abort();
    else callerSignal?.addEventListener('abort', abort, { once: true });
    active.add(controller);
    const release = (): void => {
      active.delete(controller);
      callerSignal?.removeEventListener('abort', abort);
    };
    try {
      const response = await inner(input, {
        ...init,
        signal: controller.signal,
      });
      return trackAbortableResponse(response, controller.signal, release);
    } catch (error) {
      release();
      throw error;
    }
  };
}
