import { expect, test } from 'bun:test';
import { MultiplayerGameActions } from '@libs/game-matchmaking-client-ts/multiplayer-game-actions';
import type { MultiplayerControlsModel } from '@libs/game-matchmaking-client-ts/use-multiplayer-controls';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createLocalSyncStatusStore } from '@pkgs/sync-engine-client-ts/local-sync-status';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { createSignal } from 'solid-js';
import {
  frameFixture,
  MATCH,
  renderMatchFrame,
} from './multiplayer-presentation-fixture';

// regression: rematch-command-during-disconnection
test('rematch commands follow connectivity without losing the offered game', () => {
  const time = createHarnessClock();
  const status = createLocalSyncStatusStore();
  const [offer, setOffer] = createSignal('bob');
  const controls = {} as MultiplayerControlsModel;
  const engine = {
    status: status.status,
    watch: () => undefined,
  } as unknown as SyncEngine;
  const view = renderMatchFrame(frameFixture(), () => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <SyncEngineProvider value={engine}>
        <MultiplayerGameActions
          game={{ ...MATCH, outcome: 'white', rematch_offer_by: offer() }}
          execution={undefined}
          myId="alice"
          controls={controls}
          looking={false}
          onConfirm={() => undefined}
        />
      </SyncEngineProvider>
    </ClockProvider>
  ));
  const accept = view.getByTestId('multiplayer-accept-rematch');
  const decline = view.getByTestId('multiplayer-decline-rematch');
  expect(accept).not.toHaveAttribute('disabled');
  status.patch({ online: false });
  expect(accept.hasAttribute('disabled')).toBe(true);
  expect(decline.hasAttribute('disabled')).toBe(true);
  status.patch({ online: true });
  expect(view.getByTestId('multiplayer-accept-rematch')).toBe(accept);
  expect(accept).not.toHaveAttribute('disabled');
  expect(decline).not.toHaveAttribute('disabled');
  setOffer('');
  const offerButton = view.getByTestId('multiplayer-offer-rematch');
  expect(offerButton).not.toHaveAttribute('disabled');
  status.patch({ online: false });
  expect(offerButton.hasAttribute('disabled')).toBe(true);
  status.patch({ online: true });
  expect(offerButton).not.toHaveAttribute('disabled');
});
