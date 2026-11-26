import { expect, test } from 'bun:test';
import { BATTLESHIP_PLAYABLE } from '@libs/battleship-harness-ts/battleship-playable';
import { readyKnownSetups } from '@libs/runtime-harness-ts/game-journey';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

/** The locked setup hides both ship controls until the parked tab reconnects. */
function reconnectingSetup(side: 'white' | 'black', compact: boolean) {
  let online = false;
  let pickerOpen = false;
  let chosen = false;
  const events: string[] = [];
  const base = journeyDiagnosticDriver({
    html: null,
    visible: [],
    captions: {},
    texts: {},
  }).ui;
  const ui: Driver = {
    ...base,
    get: (id) => {
      const node = base.get(id);
      return {
        ...node,
        isVisible: async () => {
          if (id === 'multiplayer-setup-ship-picker') return compact && online;
          if (id === 'multiplayer-setup-region') return compact;
          return false;
        },
        wait: async () => {},
        attribute: async (name) =>
          id === 'multiplayer-seat-near' && name === 'data-side' ? side : 'h',
        tap: async () => {
          if (
            !online ||
            (id.includes('-ship-') &&
              !id.endsWith('-picker') &&
              compact &&
              !pickerOpen)
          )
            throw new Error(`node ${id} tap: waiting for visible`);
          events.push(id);
          if (id === 'multiplayer-setup-ship-picker') pickerOpen = true;
          else if (id.includes('-ship-')) pickerOpen = false;
          else if (id === 'multiplayer-setup-choose') chosen = true;
        },
        expect: {
          ...node.expect,
          hidden: async () => {
            if (id === 'multiplayer-offline') {
              events.push('connected');
              online = true;
            } else if (
              id === 'multiplayer-setup-choose' ||
              id === 'multiplayer-setup-status'
            )
              expect(chosen).toBe(true);
          },
        },
      };
    },
  };
  return { ui, events };
}

// regression: battleship-setup-seat-readiness-timeout
// regression: battleship-journey-setup-before-reconnection
test.each([true, false])(
  'both people reconnect before arranging the compact=%s private setup',
  async (compact) => {
    const host = reconnectingSetup('white', compact);
    const peer = reconnectingSetup('black', compact);
    expect(
      await readyKnownSetups(
        {
          act: async (_name, gestures) => gestures(host.ui),
          actAsGuest: async (_name, gestures) => gestures(peer.ui),
        },
        BATTLESHIP_PLAYABLE
      )
    ).toBe(true);
    for (const device of [host, peer]) {
      expect(device.events[0]).toBe('connected');
      expect(device.events).toContain('multiplayer-setup-ship-carrier');
      expect(device.events.at(-1)).toBe('multiplayer-setup-choose');
    }
  }
);
