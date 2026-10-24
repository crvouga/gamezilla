// @io-wall-ok — isolated application realm; all nondeterminism is injected below.

import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { setDomWindow } from '@pkgs/bun-test-solid-client-ts/register';
import { createApplicationInstance } from './application-instance';
import { workerWallPorts } from './wall-io';

const wall = workerWallPorts();

import type { SessionInput } from './session-messages';
import { SessionRuntime } from './session-runtime';

let runtime: SessionRuntime | null = null;
globalThis.addEventListener('message', (event: MessageEvent<SessionInput>) => {
  const input = event.data;
  if (input.type !== 'start') {
    runtime?.receive(input);
    return;
  }
  if (runtime !== null)
    throw new Error('An application realm cannot be assigned twice');
  setDomWindow({ width: 1024, height: 768, url: input.origin });
  runtime = new SessionRuntime(input.assignment, input.origin, {
    clock: wall.clock,
    timers: wall.timers,
    games: GAME_AUTOMATIONS,
    openApplication: createApplicationInstance,
    send: (value) => globalThis.postMessage(value),
  });
  void runtime.start().catch(async () => runtime?.close());
});
