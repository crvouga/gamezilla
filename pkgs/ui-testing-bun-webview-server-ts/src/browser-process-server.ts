// @io-wall-ok — owned browser child transport; private IPC only.
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import type { TraceBrowserCall } from './browser-call-diagnostics';
import { type BrowserCall, runsNoPageCode } from './remote-browser-driver';

export type BrowserDevice = {
  readonly driver: Driver & { get(id: string, scope?: 'document'): DriverNode };
  readonly view: object;
  readonly console?: readonly string[];
  readonly network?: readonly string[];
  readonly traceCall?: TraceBrowserCall;
  close(): Promise<void>;
};

async function invoke(
  device: BrowserDevice,
  call: BrowserCall
): Promise<unknown> {
  // Bun updates the native URL when navigation completes. Reading it does
  // not execute JavaScript in the document the browser is tearing down.
  if (call.target === 'view' && call.method === 'loadedUrl')
    return Reflect.get(device.view, 'url');
  if (call.target === 'view' && call.method === 'readyDocument') {
    if (Reflect.get(device.view, 'loading')) return null;
    const url = URL.parse(Reflect.get(device.view, 'url'));
    const title: unknown = Reflect.get(device.view, 'title');
    return url && typeof title === 'string'
      ? { origin: url.origin, title }
      : null;
  }
  if (call.target === 'driver' && call.method === 'close')
    return device.close();
  let target: unknown =
    call.target === 'driver'
      ? device.driver
      : call.target === 'view'
        ? device.view
        : call.path.reduce<Pick<Driver, 'get'>>(
            (value, id) => value.get(id),
            call.target === 'document-node'
              ? {
                  get: (id: string) => device.driver.get(id, 'document'),
                }
              : device.driver
          );
  const parts = call.method.split('.');
  for (const part of parts.slice(0, -1))
    target = Reflect.get(target as object, part);
  const result = await Reflect.apply(
    Reflect.get(target as object, parts.at(-1)!),
    target,
    [...call.args]
  );
  return call.method === 'screenshot'
    ? Buffer.from(result as Uint8Array).toString('base64')
    : result;
}

type BrowserRequest<Open> = {
  readonly id: number;
  readonly open?: Open;
  readonly call?: BrowserCall;
};

/**
 * One device's request handler. `Bun.WebView` allows one `evaluate()` in
 * flight per view, and a driver call is a chain of them, so calls run one
 * after another: a call the parent sent while another still runs waits for
 * it instead of failing inside Bun with "an evaluate() is already pending".
 * Reading native navigation state and closing run at once — neither runs page code,
 * and closing is what ends a call stuck in the page.
 */
export function createBrowserRequestHandler<Open>(
  open: (options: Open) => Promise<BrowserDevice>,
  send: (message: unknown) => void
) {
  let device: BrowserDevice | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const run = async (request: BrowserRequest<Open>, call: BrowserCall) => {
    const current = device;
    if (current === null) throw new Error('Invalid browser request');
    send({ id: request.id, stage: 'executing' });
    const value =
      (call.target === 'node' || call.target === 'document-node') &&
      (call.method === 'tap' || call.method === 'isVisible') &&
      current.traceCall
        ? await current.traceCall(
            () => invoke(current, call),
            (operation) =>
              send({ id: request.id, stage: 'executing', operation })
          )
        : await invoke(current, call);
    if (call.target === 'driver' && call.method === 'close') device = null;
    return value;
  };
  const handle = async (request: BrowserRequest<Open>): Promise<void> => {
    try {
      let value: unknown;
      if (request.open !== undefined) {
        if (device !== null) throw new Error('The browser is already open');
        send({ id: request.id, stage: 'opening' });
        device = await open(request.open);
        value = true;
      } else if (request.call !== undefined && device !== null) {
        const call = request.call;
        if (runsNoPageCode(call)) value = await run(request, call);
        else {
          const turn = queue.then(() => run(request, call));
          queue = turn.catch(() => undefined);
          value = await turn;
        }
      } else throw new Error('Invalid browser request');
      send({
        id: request.id,
        value,
        console: device?.console,
        network: device?.network,
      });
    } catch (cause) {
      send({
        id: request.id,
        error: cause instanceof Error ? cause.message : String(cause),
        errorName: cause instanceof Error ? cause.name : 'Error',
      });
    }
  };
  return { handle, device: () => device };
}

/** Both harness and deployed-app adapters keep all native work in this child. */
export function serveBrowserProcess<Open>(
  open: (options: Open) => Promise<BrowserDevice>
): void {
  const handler = createBrowserRequestHandler(open, (message) =>
    process.send?.(message)
  );
  process.on('message', (raw: unknown) => {
    void handler.handle(raw as BrowserRequest<Open>);
  });
  let closing = false;
  function close(): void {
    if (closing) return;
    closing = true;
    const device = handler.device();
    if (device === null) process.exit(0);
    void device.close().finally(() => process.exit(0));
  }
  process.on('disconnect', close);
  process.on('SIGTERM', close);
}
