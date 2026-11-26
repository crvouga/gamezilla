// @io-wall-ok — live browser process transport with a bounded request lifetime.
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';
import { NotImplementedError } from '@pkgs/ui-testing-root-shared-ts/not-implemented-error';
import { TimeoutError } from '@pkgs/ui-testing-root-shared-ts/timeout-error';
import { UiTestError } from '@pkgs/ui-testing-root-shared-ts/ui-test-error';
import { type BrowserCall, runsNoPageCode } from './remote-browser-driver';

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
/** What a call was asked to do, without its arguments (they may be typed secrets). */
function describeCall(call: BrowserCall): string {
  return `${call.target} ${call.path.join('/').slice(0, 240)} ${call.method.slice(0, 80)}`;
}

/** A failed call, said with what it was asked to do, as its own class. */
function callFailure(call: BrowserCall | undefined, error: Error): Error {
  if (call === undefined) return error;
  const message = `${describeCall(call)}: ${error.message}`;
  return reviveBrowserError(error.name, message, { cause: error });
}

/** A call the browser has not answered within its deadline. */
function noAnswer(call: BrowserCall | undefined, stage: string): Error {
  return callFailure(
    call,
    new Error(
      `The isolated browser did not answer after ${BROWSER_REQUEST_MS}ms (stage: ${stage})`
    )
  );
}

/**
 * A call the parent stopped waiting for still runs in the browser, which
 * does one page call at a time: every later one would wait out its own
 * deadline behind it. Until its answer arrives they fail at once, naming it.
 */
function stuckCallGuard() {
  let stuck: { readonly id: number; readonly call: string } | null = null;
  return {
    timedOut(id: number, stage: string, call: BrowserCall | undefined) {
      if (stage === 'executing' && call !== undefined)
        stuck = { id, call: describeCall(call) };
    },
    answered(id: number) {
      if (stuck?.id === id) stuck = null;
    },
    refusal(call: BrowserCall | undefined): Error | null {
      if (stuck === null || call === undefined || runsNoPageCode(call))
        return null;
      return callFailure(
        call,
        new Error(
          `The isolated browser is still running ${stuck.call}, which did not answer after ${BROWSER_REQUEST_MS}ms`
        )
      );
    },
  };
}

type BrowserResponse = {
  id: number;
  value?: unknown;
  error?: string;
  errorName?: string;
  console?: string[];
  network?: string[];
  stage?: 'opening' | 'executing';
  operation?: string;
};

export function browserProcessChannel<Open>(
  process: IsolatedWorker,
  timers: Timers
) {
  const pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      progress: (stage: 'opening' | 'executing', operation?: string) => void;
    }
  >();
  let sequence = 0;
  const guard = stuckCallGuard();
  const consoleLines: string[] = [];
  const networkLines: string[] = [];
  const fail = (error: Error): void => {
    for (const reply of pending.values()) reply.reject(error);
    pending.clear();
  };
  const unsubscribe = process.subscribe((raw) => {
    const response = raw as BrowserResponse;
    if (response.console !== undefined)
      consoleLines.splice(0, consoleLines.length, ...response.console);
    if (response.network !== undefined)
      networkLines.splice(0, networkLines.length, ...response.network);
    const reply = pending.get(response.id);
    if (response.stage === 'opening' || response.stage === 'executing') {
      reply?.progress(response.stage, response.operation);
      return;
    }
    guard.answered(response.id);
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
      const refusal = guard.refusal(payload.call);
      if (refusal !== null) {
        reject(refusal);
        return;
      }
      const id = ++sequence;
      let stage = 'sent';
      let operation: string | undefined;
      const timer = timers.setTimeout(() => {
        pending.delete(id);
        guard.timedOut(id, stage, payload.call);
        reject(
          noAnswer(payload.call, operation ? `${stage}; ${operation}` : stage)
        );
      }, BROWSER_REQUEST_MS);
      pending.set(id, {
        progress: (value, detail) => {
          stage = value;
          operation = detail;
        },
        resolve: (value) => {
          timers.clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          timers.clearTimeout(timer);
          reject(callFailure(payload.call, error));
        },
      });
      process.post({ id, ...payload, ...serializableCall(payload.call) });
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

/** IPC cannot serialize trailing undefined arguments. */
function serializableCall(call: BrowserCall | undefined) {
  if (call === undefined) return {};
  return {
    call: {
      ...call,
      args: call.args.slice(
        0,
        call.args.findLastIndex((value) => value !== undefined) + 1
      ),
    },
  };
}
