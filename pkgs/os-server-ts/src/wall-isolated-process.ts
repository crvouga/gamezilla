// @io-wall-ok — independent browser processes cannot share a browser profile.
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { IsolatedWorker } from './wall-isolated-worker';
/** The worker port backed by a process, for libraries with process-global state. */
export function createIsolatedProcess(moduleUrl: URL): IsolatedWorker {
  const child = fork(fileURLToPath(moduleUrl), [], {
    execPath: process.execPath,
    execArgv: [],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  return {
    post: (value) => {
      child.send(value as Parameters<typeof child.send>[0]);
    },
    subscribe: (listener) => {
      child.on('message', listener);
      return () => {
        child.off('message', listener);
      };
    },
    onError: (listener) => {
      const error = (cause: Error) => listener(cause.message);
      const exit = () => listener('The isolated process exited');
      child.on('error', error);
      child.on('exit', exit);
      return () => {
        child.off('error', error);
        child.off('exit', exit);
      };
    },
    terminate: () => {
      if (child.connected) child.disconnect();
      child.kill('SIGTERM');
    },
  };
}
