// @io-wall-ok — isolated application composition root; the catalog is injected by its host.
import { setDomWindow } from '@pkgs/bun-test-solid-client-ts/register';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { SessionInput } from './session-messages';
import { SessionRuntime } from './session-runtime';
import { workerWallPorts } from './wall-io';

/** Production offers the full catalog; a focused host may offer a compatible game group. */
export function startSessionRealm(
  games: readonly GameAutomation<Driver>[]
): void {
  const wall = workerWallPorts();
  let runtime: SessionRuntime | null = null;
  globalThis.addEventListener(
    'message',
    (event: MessageEvent<SessionInput>) => {
      const input = event.data;
      if (input.type !== 'start') {
        runtime?.receive(input);
        return;
      }
      if (runtime !== null)
        throw new Error('An application realm cannot be assigned twice');
      setDomWindow({ width: 1024, height: 768, url: input.origin });
      runtime = new SessionRuntime(input.assignment, input.origin, {
        games,
        clock: wall.clock,
        timers: wall.timers,
        send: (value) => globalThis.postMessage(value),
      });
      void runtime.start().catch(async () => runtime?.close());
    }
  );
}
