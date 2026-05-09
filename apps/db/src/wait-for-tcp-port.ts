import * as net from 'node:net';
import { assert } from '@gamezilla/lib/assert';

/**
 * Tiger style (see repo `LLM.md`): reject malformed wait parameters up front.
 */
export function waitForTcpPort(
  host: string,
  port: number,
  timeoutMs: number
): Promise<void> {
  assert.nonEmptyString(host, 'waitForTcpPort: host must be non-empty', {
    host,
  });
  assert.integer(
    port,
    `waitForTcpPort: port must be an integer (port: ${String(port)})`
  );
  assert.ok(
    port >= 1 && port <= 65_535,
    'waitForTcpPort: port must be in 1..65535',
    {
      port,
    }
  );
  assert.nonNegativeInteger(
    timeoutMs,
    `waitForTcpPort: timeoutMs must be a non-negative integer (timeoutMs: ${String(timeoutMs)})`
  );

  const deadline = Date.now() + timeoutMs;

  const tryOnce = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        reject(new Error('connect failed'));
      });
    });

  const loop = async (): Promise<void> => {
    for (;;) {
      if (Date.now() > deadline) {
        throw new Error(
          `timed out after ${String(timeoutMs)}ms waiting for ${host}:${String(port)}`
        );
      }
      try {
        await tryOnce();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  };

  return loop();
}
