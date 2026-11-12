// @io-wall-ok — the browser's service worker and its messages.
/**
 * Addresses for the harness's vendor emulators. They run in this page, so
 * nothing serves their dashboards anywhere a frame could load them from; the
 * gateway's service worker (`public/emulator-gateway-sw.js`) hands every
 * request under `/__emulators/<page>/<id>/` to this page, which asks the
 * emulator and hands its answer back.
 */

import {
  HARNESS_EMULATOR_DASHBOARD_PATH,
  type HarnessEmulator,
} from '@libs/harness-ts/emulators';

const WORKER_URL = '/emulator-gateway-sw.js';
const PREFIX = '/__emulators';

type EmulatorRequest = {
  readonly type: 'harness-emulator-request';
  readonly page: string;
  readonly emulator: string;
  readonly method: string;
  readonly path: string;
  readonly headers: readonly (readonly [string, string])[];
  readonly body: ArrayBuffer | null;
};

export type EmulatorGateway = {
  /** Where a frame loads the emulator's dashboard; `null` without a gateway. */
  dashboardUrl(emulator: string): string | null;
  dispose(): void;
};

function isEmulatorRequest(data: unknown): data is EmulatorRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === 'harness-emulator-request'
  );
}

/** A browser that cannot run the worker has no dashboards, and says so. */
const NO_GATEWAY: EmulatorGateway = {
  dashboardUrl: () => null,
  dispose: () => undefined,
};

/**
 * Serve `emulators()` to this page's frames. The list is read on every
 * request, since a payment provider can be booted after the page opens.
 */
export function openEmulatorGateway(
  emulators: () => readonly HarnessEmulator[]
): EmulatorGateway {
  if (!('serviceWorker' in navigator)) return NO_GATEWAY;
  // Names this page among the tabs the worker serves.
  const page = crypto.randomUUID();
  const answer = async (request: EmulatorRequest, port: MessagePort) => {
    const emulator = emulators().find((each) => each.id === request.emulator);
    if (emulator === undefined) {
      port.postMessage({ status: 404, headers: [], body: null });
      return;
    }
    try {
      const response = await emulator.fetch(
        `${emulator.origin}${request.path}`,
        {
          method: request.method,
          headers: request.headers.map(([name, value]) => [name, value]),
          ...(request.body === null ? {} : { body: request.body }),
        }
      );
      const body = await response.arrayBuffer();
      port.postMessage(
        { status: response.status, headers: [...response.headers], body },
        [body]
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      port.postMessage({
        status: 502,
        headers: [['content-type', 'text/plain; charset=utf-8']],
        body: new TextEncoder().encode(text).buffer,
      });
    }
  };
  const onMessage = (event: MessageEvent): void => {
    const port = event.ports[0];
    if (!isEmulatorRequest(event.data) || port === undefined) return;
    // Another tab's request: its own page answers it.
    if (event.data.page !== page) return;
    void answer(event.data, port);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  // Never fatal: without the worker the frames show the browser's own error.
  void navigator.serviceWorker.register(WORKER_URL).catch(() => undefined);
  return {
    dashboardUrl: (emulator) =>
      `${PREFIX}/${page}/${encodeURIComponent(emulator)}${HARNESS_EMULATOR_DASHBOARD_PATH}`,
    dispose: () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    },
  };
}
