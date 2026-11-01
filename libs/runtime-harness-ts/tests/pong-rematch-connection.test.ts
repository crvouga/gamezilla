import { expect, test } from 'bun:test';
import type { JourneyHost } from '@libs/runtime-harness-ts/journey-types';
import { acceptPongRematch } from '@libs/runtime-harness-ts/pong-rematch-journey';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: live-journey-command-before-reconnection
test('accepting a rematch waits for the connection before the command', async () => {
  let online = false;
  let accepted = false;
  const unused = (): never => {
    throw new Error('Unexpected gesture');
  };
  const ui: Driver = {
    kind: 'reconnecting-pong',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      scroll: unused,
      key: unused,
      isVisible: unused,
      text: unused,
      wait: async () => {},
      tap: async () => {
        if (!online) throw new Error('This action needs a connection.');
        expect(id).toBe('multiplayer-accept-rematch');
        accepted = true;
      },
      expect: {
        visible: unused,
        text: unused,
        hidden: async () => {
          expect(id).toBe('multiplayer-offline');
          online = true;
        },
      },
    }),
  };
  const act: JourneyHost['act'] = async (_name, gestures) => gestures(ui);
  const host: JourneyHost = {
    runId: 'reconnecting-pong',
    browser: null,
    showsPuzzleAnswers: false,
    now: unused,
    elapse: unused,
    open: unused,
    openPeer: unused,
    act,
    actAsGuest: act,
    spaceLink: unused,
    openLink: unused,
    openGuest: unused,
    offline: unused,
    online: unused,
    reopen: unused,
    defer: unused,
    settle: unused,
    peerDevice: {
      spaceLink: unused,
      reopen: unused,
      offline: unused,
      online: unused,
      anotherSignedInDevice: unused,
    },
  };
  await acceptPongRematch(host, 'alice');
  expect(accepted).toBe(true);
});
