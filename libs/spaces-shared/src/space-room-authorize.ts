import type { AppGrantKey } from '@libs/permissions-shared/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Message } from '@pkgs/message-shared/message';
import { isMessageEnvelope } from '@pkgs/message-shared/message';
import {
  ROOM_PRESENCE_IDENTITY,
  ROOM_SCHEDULER_IDENTITY,
} from '@pkgs/room-root-shared/builtin';
import {
  ROOM_SERVICE_GRANT,
  ROOM_SERVICE_IDENTITY,
} from '@pkgs/room-root-shared/service-identity';
import type { RoomCommand } from '@pkgs/room-root-shared/types';
import type { GameDefinition } from './game';
import { SelectGame } from './games';
import { AnnounceRenamed } from './space-log-messages';
import {
  ApplySpaceMembership,
  ApplySpaceRestrictions,
} from './space-service-command';

/** Grants the spaces gateway decides; games contribute their own grants. */
export const SPACE_ROOM_GRANT_KEYS = [
  PERMISSION.spacesSelectGame,
  PERMISSION.spacesLeave,
  PERMISSION.spacesEnd,
  PERMISSION.spacesRename,
] as const;
type Verdict = { ok: true } | { ok: false; reason: string };
type RequiredGrant = { readonly key: AppGrantKey; readonly reason: string };

function spaceCommandGrant(msg: Message): RequiredGrant | null {
  if (msg.type === SelectGame.type)
    return {
      key: PERMISSION.spacesSelectGame,
      reason: 'only the host makes the game choice',
    };
  if (msg.type === AnnounceRenamed.type)
    return {
      key: PERMISSION.spacesRename,
      reason: 'only the host renames the space',
    };
  return null;
}

/** Every feature supplies the capability associated with its commands. */
export function createSpaceRoomAuthorizer(
  games: readonly GameDefinition[]
): (
  identity: string,
  topic: string,
  command: RoomCommand,
  grants: readonly string[]
) => Promise<Verdict> {
  return (identity, _topic, command, grants) => {
    if (
      identity !== ROOM_SERVICE_IDENTITY &&
      identity !== ROOM_PRESENCE_IDENTITY &&
      identity !== ROOM_SCHEDULER_IDENTITY &&
      !grants.includes(PERMISSION.spacesLeave)
    ) {
      return Promise.resolve({
        ok: false,
        reason: 'join the space before sending commands',
      });
    }
    const msg = isMessageEnvelope(command.payload) ? command.payload : null;
    if (msg === null) return Promise.resolve({ ok: true });
    if (
      msg.type === ApplySpaceMembership.type ||
      msg.type === ApplySpaceRestrictions.type
    )
      return Promise.resolve(
        grants.includes(ROOM_SERVICE_GRANT)
          ? { ok: true }
          : { ok: false, reason: 'requires the space service' }
      );
    let required = spaceCommandGrant(msg);
    for (const game of games)
      required ??= game.permissionForCommand?.(msg) ?? null;
    return Promise.resolve(
      required === null || grants.includes(required.key)
        ? { ok: true }
        : { ok: false, reason: required.reason }
    );
  };
}
