import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { isMessageEnvelope } from '@pkgs/message';
import type { RoomCommand } from '@pkgs/room';

import { SelectGame } from './games';

/**
 * The permission keys a space room enforces per command. The room gateway
 * decides each for the connecting actor (their presence role in the space,
 * through `@libs/permissions`) and admits the connection with the ones they
 * hold.
 */
export const SPACE_ROOM_GRANT_KEYS = [PERMISSION.spacesSelectGame] as const;

type Verdict = { ok: true } | { ok: false; reason: string };

/**
 * The space room's per-command gate (`RoomServerConfig.authorize`): the game
 * choice needs `spaces:select-game` among the grants the sender's connection
 * was admitted with; every other command is the module's to judge.
 */
export function authorizeSpaceRoomCommand(
  _identity: string,
  _topic: string,
  command: RoomCommand,
  grants: readonly string[]
): Promise<Verdict> {
  const msg = isMessageEnvelope(command.payload) ? command.payload : null;
  if (msg === null || msg.type !== SelectGame.type) {
    return Promise.resolve({ ok: true });
  }
  if (grants.includes(PERMISSION.spacesSelectGame)) {
    return Promise.resolve({ ok: true });
  }
  return Promise.resolve({
    ok: false,
    reason: 'only the host makes the game choice',
  });
}
