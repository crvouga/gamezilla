// @io-wall-ok — live browser process transport with a bounded request lifetime.
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';
import { NotImplementedError } from '@pkgs/ui-testing-root-shared-ts/not-implemented-error';
import { TimeoutError } from '@pkgs/ui-testing-root-shared-ts/timeout-error';
import { UiTestError } from '@pkgs/ui-testing-root-shared-ts/ui-test-error';
import type { BrowserCall } from './remote-browser-driver';

const BROWSER_REQUEST_MS = 90_000;

/** The UI-testing failures callers tell apart by class, by name. */
const UI_ERRORS: Readonly<Record<string, { readonly prototype: Error }>> = {
  ElementNotFoundError,
  NotImplementedError,
  TimeoutError,
  UiTestError,
};

/**
 * An error the browser process threw, as its own class again: only its
 * name and message cross the process boundary, and callers tell a missing
 * element (`ElementNotFoundError`) from any other failure by its class.
 */
export function reviveBrowserError(
  name: string | undefined,
  message: string,
  options?: { readonly cause?: unknown }
): Error {
  // regression: browser-process-error-class-lost
  const error = new Error(message, options);
  const known = name === undefined ? undefined : UI_ERRORS[name];
  if (known === undefined) return error;
  Object.setPrototypeOf(error, known.prototype);
  error.name = name as string;
  return error;
}
/** A failed call, said with what it was asked to do, as its own class. */
function callFailure(call: BrowserCall | undefined, error: Error): Error {
  if (call === undefined) return error;
  return reviveBrowserError(
    error.name,
    `${call.target} ${call.path.join('/').slice(0, 240)} ${call.method.slice(0, 80)}: ${error.message}`,
    { cause: error }
  );
}

export function browserProcessChannel<Open>(
  process: IsolatedWorker,
  timers: Timers
) {
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
      errorName?: string;
      console?: string[];
      network?: string[];
    };
    if (response.console !== undefined)
      consoleLines.splice(0, consoleLines.length, ...response.console);
    if (response.network !== undefined)
      networkLines.splice(0, networkLines.length, ...response.network);
    const reply = pending.get(response.id);
    pending.delete(response.id);
    if (response.error !== undefined)
      reply?.reject(reviveBrowserError(response.errorName, response.error));
    else reply?.resolve(response.value);
  });
  const unwatch = process.onError((message) => fail(new Error(message)));
  const request = <T>(payload: {
    open?: Open;
    call?: BrowserCall;
  }): Promise<T> =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = timers.setTimeout(() => {
        pending.delete(id);
        reject(new Error('The isolated browser did not answer'));
      }, BROWSER_REQUEST_MS);
      pending.set(id, {
        resolve: (value) => {
          timers.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          timers.clearTimeout(timer);
          reject(callFailure(payload.call, error));
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
    close: async () => {
      unsubscribe();
      unwatch();
      fail(new Error('The browser closed'));
      await process.terminate();
    },
  };
}
