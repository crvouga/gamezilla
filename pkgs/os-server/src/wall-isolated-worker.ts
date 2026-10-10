// @io-wall-ok — isolated JavaScript process realm at a runtime composition root.
export type IsolatedWorker = {
  post(value: unknown): void;
  subscribe(listener: (value: unknown) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  terminate(): void;
};
/** Each realm owns globals, module singletons, storage, timers and sockets. */
export function createIsolatedWorker(
  moduleUrl: URL,
  preload: readonly string[],
  environment: Readonly<Record<string, string>> = {}
): IsolatedWorker {
  const worker = new Worker(moduleUrl.href, {
    preload: [...preload],
    smol: true,
    ref: true,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      ),
      ...environment,
    },
  });
  return {
    post: (value) => worker.postMessage(value),
    subscribe: (listener) => {
      const handle = (event: MessageEvent) => listener(event.data as unknown);
      worker.addEventListener('message', handle);
      return () => worker.removeEventListener('message', handle);
    },
    onError: (listener) => {
      const handle = (event: ErrorEvent) => listener(event.message);
      worker.addEventListener('error', handle);
      return () => worker.removeEventListener('error', handle);
    },
    terminate: () => worker.terminate(),
  };
}
