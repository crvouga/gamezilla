// @io-wall-ok — owned browser child transport; private IPC only.
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { BrowserCall } from './remote-browser-driver';

type BrowserDevice = {
  readonly driver: Driver;
  readonly view: object;
  readonly console?: readonly string[];
  readonly network?: readonly string[];
  close(): Promise<void>;
};

async function invoke(
  device: BrowserDevice,
  call: BrowserCall
): Promise<unknown> {
  if (call.target === 'driver' && call.method === 'close')
    return device.close();
  let target: unknown =
    call.target === 'driver'
      ? device.driver
      : call.target === 'view'
        ? device.view
        : call.path.reduce(
            (value, id) => value.get(id),
            device.driver as Pick<Driver, 'get'>
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

/** Both harness and deployed-app adapters keep all native work in this child. */
export function serveBrowserProcess<Open>(
  open: (options: Open) => Promise<BrowserDevice>
): void {
  let device: BrowserDevice | null = null;
  process.on('message', async (raw: unknown) => {
    const request = raw as { id: number; open?: Open; call?: BrowserCall };
    try {
      let value: unknown;
      if (request.open !== undefined) {
        if (device !== null) throw new Error('The browser is already open');
        device = await open(request.open);
        value = true;
      } else if (request.call !== undefined && device !== null) {
        value = await invoke(device, request.call);
        if (request.call.target === 'driver' && request.call.method === 'close')
          device = null;
      } else throw new Error('Invalid browser request');
      process.send?.({
        id: request.id,
        value,
        console: device?.console,
        network: device?.network,
      });
    } catch (cause) {
      process.send?.({
        id: request.id,
        error: cause instanceof Error ? cause.message : String(cause),
        errorName: cause instanceof Error ? cause.name : 'Error',
      });
    }
  });
  let closing = false;
  function close(): void {
    if (closing) return;
    closing = true;
    if (device === null) process.exit(0);
    void device.close().finally(() => process.exit(0));
  }
  process.on('disconnect', close);
  process.on('SIGTERM', close);
}
