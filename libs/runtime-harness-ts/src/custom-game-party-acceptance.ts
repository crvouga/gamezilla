import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  type PartyTurnProgress,
  partyMoveContext,
  readPublicCustomGame,
} from './custom-game-party-turn';
import { check, JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';

type PartyHost = Pick<JourneyHost, 'act' | 'actAsGuest'>;
type DeviceState = { readonly board: string; readonly error: string };
type PartyDevices = { host: DeviceState; peer: DeviceState };

async function deviceState(ui: Driver): Promise<DeviceState> {
  const board = await readPublicCustomGame(ui).catch(() => null);
  const error = ui.get('custom-game-error');
  return {
    board: partyMoveContext(board),
    error: (await error.isVisible())
      ? ((await error.text()) ?? '').slice(0, 800)
      : '',
  };
}

/** Public snapshots only: a failed diagnostic must not replace the original cause. */
export async function readPartyDevices(host: PartyHost): Promise<PartyDevices> {
  const missing: DeviceState = {
    board: 'null',
    error: 'Device snapshot unavailable',
  };
  const devices: PartyDevices = { host: missing, peer: missing };
  await host
    .act('readPartyHostAcceptance', async (ui) => {
      devices.host = await deviceState(ui);
    })
    .catch(() => undefined);
  await host
    .actAsGuest('readPartyPeerAcceptance', async (ui) => {
      devices.peer = await deviceState(ui);
    })
    .catch(() => undefined);
  return devices;
}

/** A move shown by its actor alone is provisional, never shared acceptance. */
export async function acceptPartyProgress(
  host: PartyHost,
  ply: number,
  before: PartyDevices,
  attempted: PartyTurnProgress['attempted']
): Promise<void> {
  const accepted = async (ui: Driver): Promise<void> => {
    await ui
      .get(`custom-game-review-move-${ply}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    const view = await readPublicCustomGame(ui);
    check(view.ply >= ply, 'The accepted party move rolled back');
    const error = ui.get('custom-game-error');
    if (await error.isVisible())
      throw new Error(`Party move rejected: ${await error.text()}`);
  };
  try {
    await host.actAsGuest('acceptPartyPeerMove', accepted);
    await host.act('acceptPartyHostMove', accepted);
  } catch (cause) {
    const after = await readPartyDevices(host);
    throw new Error(
      `Party acceptance ${ply}; action ${attempted?.action.slice(0, 80) ?? 'bot'}; chosen ${partyMoveContext(attempted?.chosen ?? null)}; before ${JSON.stringify(before)}; after ${JSON.stringify(after)}`,
      { cause }
    );
  }
}
