// @io-wall-ok — owned live browser child process; private IPC only.

import type { Device } from './live-browser';
import { openDevice } from './live-browser';
import type { BrowserCall } from './remote-browser-driver';

let device: Device | null = null;
async function invoke(call: BrowserCall): Promise<unknown> {
  if (device === null) throw new Error('The browser is not open');
  let target: unknown =
    call.target === 'driver'
      ? device.driver
      : call.target === 'view'
        ? device.view
        : call.path.reduce(
            (value, id) => value.get(id),
            device.driver as Pick<Device['driver'], 'get'>
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
process.on('message', async (raw: unknown) => {
  const request = raw as {
    id: number;
    open?: { webOrigin: string; apiOrigin: string };
    call?: BrowserCall;
  };
  try {
    let value: unknown;
    if (request.open !== undefined) {
      device = await openDevice(request.open);
      value = true;
    } else if (request.call !== undefined) value = await invoke(request.call);
    else throw new Error('Invalid browser request');
    process.send?.({ id: request.id, value, console: device?.console });
  } catch (cause) {
    process.send?.({
      id: request.id,
      error: cause instanceof Error ? cause.message : String(cause),
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
