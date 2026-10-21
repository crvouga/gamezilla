// @io-wall-ok — live browser process transport with a bounded request lifetime.
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import type { LiveTarget } from './live-browser';
import type { BrowserCall } from './remote-browser-driver';

const BROWSER_REQUEST_MS = 90_000;
export function browserProcessChannel(process: IsolatedWorker) {
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  let sequence = 0;
  const consoleLines: string[] = [];
  const networkLines: string[] = [];
  const fail = (error: Error): void => {
    for (const reply of pending.values()) reply.reject(error);
    pending.clear();
  };
  const unsubscribe = process.subscribe((raw) => {
    const response = raw as {
      id: number;
      value?: unknown;
      error?: string;
      console?: string[];
      network?: string[];
    };
    if (response.console !== undefined)
      consoleLines.splice(0, consoleLines.length, ...response.console);
    if (response.network !== undefined)
      networkLines.splice(0, networkLines.length, ...response.network);
    const reply = pending.get(response.id);
    pending.delete(response.id);
    if (response.error !== undefined) reply?.reject(new Error(response.error));
    else reply?.resolve(response.value);
  });
  const unwatch = process.onError((message) => fail(new Error(message)));
  const request = <T>(payload: {
    open?: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>;
    call?: BrowserCall;
  }): Promise<T> =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = wallTimers.setTimeout(() => {
        pending.delete(id);
        reject(new Error('The isolated browser did not answer'));
      }, BROWSER_REQUEST_MS);
      pending.set(id, {
        resolve: (value) => {
          wallTimers.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          wallTimers.clearTimeout(timer);
          reject(error);
        },
      });
      process.post({
        id,
        ...payload,
        ...(payload.call === undefined
          ? {}
          : {
              call: {
                ...payload.call,
                args: payload.call.args.slice(
                  0,
                  payload.call.args.findLastIndex(
                    (value) => value !== undefined
                  ) + 1
                ),
              },
            }),
      });
    });

  return {
    request,
    consoleLines,
    networkLines,
    close: () => {
      unsubscribe();
      unwatch();
      fail(new Error('The browser closed'));
      process.terminate();
    },
  };
}
