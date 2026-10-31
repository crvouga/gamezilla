import { DEADLINE_FLUSH_MS } from './verify-budget';

type FlushPorts = {
  readonly signal: (signal: NodeJS.Signals) => void;
  readonly after: (ms: number, callback: () => void) => () => void;
};

/** Stop tasks while allowing Turbo to finish uploading successful artifacts. */
export function cacheFlushStop(ports: FlushPorts) {
  let stopping = false;
  let cancelled = false;
  let cancel: (() => void) | undefined;
  const request = () => {
    if (stopping) return;
    stopping = true;
    ports.signal('SIGTERM');
    cancel = ports.after(DEADLINE_FLUSH_MS, () => ports.signal('SIGKILL'));
  };
  return {
    stopping: () => stopping,
    cancelled: () => cancelled,
    request,
    cancel: () => {
      cancelled = true;
      request();
    },
    dispose: () => cancel?.(),
  };
}
