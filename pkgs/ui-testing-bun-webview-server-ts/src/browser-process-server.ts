// @io-wall-ok — owned browser child transport; private IPC only.
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import type { TraceBrowserCall } from './browser-call-diagnostics';
import {
  documentMarker,
  type RegionMarkers,
  visibleDocumentRegion,
} from './document-region';
import { type BrowserCall, runsNoPageCode } from './remote-browser-driver';

export type BrowserDevice = {
  readonly driver: Driver & { get(id: string, scope?: 'document'): DriverNode };
  readonly view: object;
  readonly console?: readonly string[];
  readonly network?: readonly string[];
  readonly traceCall?: TraceBrowserCall;
  readonly activateBeforeNavigate?: () => Promise<void>;
  readonly readRegionMarker?: (
    markers: RegionMarkers
  ) => Promise<string | null>;
  readonly readExposedControl?: (testId: string) => Promise<boolean>;
  readonly documentLoad?: () => {
    readonly loading: boolean;
    readonly navigation: number;
  };
  close(): Promise<void>;
};

function documentState(device: BrowserDevice) {
  const load = device.documentLoad?.();
  return {
    url: Reflect.get(device.view, 'url') as string,
    loading: Boolean(load?.loading || Reflect.get(device.view, 'loading')),
    navigation: load?.navigation ?? 0,
  };
}

function readyDocument(device: BrowserDevice) {
  const state = documentState(device);
  if (state.loading) return null;
  const url = URL.parse(state.url);
  const title: unknown = Reflect.get(device.view, 'title');
  return url && typeof title === 'string'
    ? { origin: url.origin, title }
    : null;
}

const NATIVE_VIEW_READS = new Set([
  'loadedUrl',
  'readyDocument',
  'visibleRegion',
  'exposedControl',
]);

/** Reads that use the document tree or the native view, never page script. */
async function readNativeView(
  device: BrowserDevice,
  call: BrowserCall
): Promise<unknown> {
  if (call.method === 'loadedUrl') return Reflect.get(device.view, 'url');
  if (call.method === 'readyDocument') return readyDocument(device);
  if (call.method === 'visibleRegion') {
    const [origin, markers] = call.args as readonly [string, RegionMarkers];
    const read =
      device.readRegionMarker ??
      documentMarker((id) => device.driver.get(id, 'document'));
    return visibleDocumentRegion(() => documentState(device), read)(
      origin,
      markers
    );
  }
  const [origin, testId] = call.args as readonly [string, string];
  const read =
    device.readExposedControl ??
    (async (id: string) => device.driver.get(id, 'document').isVisible());
  const found = await visibleDocumentRegion(
    () => documentState(device),
    async () => ((await read(testId)) ? testId : null)
  )(origin, { [testId]: testId });
  return found === testId;
}

async function invoke(
  device: BrowserDevice,
  call: BrowserCall
): Promise<unknown> {
  if (call.target === 'view' && call.method === 'navigate')
    await device.activateBeforeNavigate?.();
  // Bun updates the native URL when navigation completes. Reading it does
  // not execute JavaScript in the document the browser is tearing down.
  if (call.target === 'view' && NATIVE_VIEW_READS.has(call.method))
    return readNativeView(device, call);
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
      (((call.target === 'node' || call.target === 'document-node') &&
        (call.method === 'tap' || call.method === 'isVisible')) ||
        (call.target === 'view' &&
          (call.method === 'visibleRegion' ||
            call.method === 'exposedControl'))) &&
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
