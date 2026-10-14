import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import type { MessageRouter } from '@pkgs/message-shared/router';
import { createMessageRouter } from '@pkgs/message-shared/router';
import type { HandleResult, RoomState } from '@pkgs/room-root-shared/types';

import type { GameCommandContext } from './game';
import { isViewingSpaceClient } from './space-presence-client-id';

const quietNs = createAttrNamespace('space', 'quiet');

export type SpaceQuietMap = Readonly<Record<string, true>>;

function parseQuiet(value: unknown): SpaceQuietMap {
  if (!isPlainRecord(value)) return {};
  const out: Record<string, true> = {};
  for (const [clientId, mark] of Object.entries(value)) {
    if (mark === true && clientId.length > 0) out[clientId] = true;
  }
  return out;
}

/** Per viewing client: quiet for two minutes. Keyed by room client id. */
export const SpaceQuietRoomAttr = {
  quiet: quietNs.json('marks', parseQuiet),
} as const;

function validateMark(payload: unknown): payload is SpaceQuietMark {
  return (
    isPlainRecord(payload) &&
    typeof payload['clientId'] === 'string' &&
    payload['clientId'].length > 0 &&
    typeof payload['quiet'] === 'boolean'
  );
}

export type SpaceQuietMark = {
  readonly clientId: string;
  readonly quiet: boolean;
};

export const spaceQuietCmdNs = createMessageNamespace('space-quiet-cmd');
export const MarkQuiet = spaceQuietCmdNs('mark-quiet', validateMark);

export const spaceQuietEvtNs = createMessageNamespace('space-quiet-evt');
export const QuietMarked = spaceQuietEvtNs('quiet-marked', validateMark);

export const spaceQuietCommandRouter: MessageRouter<
  RoomState,
  GameCommandContext,
  HandleResult
> = createMessageRouter<RoomState, GameCommandContext, HandleResult>(
  spaceQuietCmdNs
).on(MarkQuiet, (_state, _ctx, cmd) => ({
  ok: true,
  events: [QuietMarked(cmd.payload)],
}));

export const spaceQuietEventReducer: MessageRouter<RoomState, void, RoomState> =
  createMessageRouter<RoomState, void, RoomState>(spaceQuietEvtNs).on(
    QuietMarked,
    (state, _ctx, evt) => {
      const quiet = { ...SpaceQuietRoomAttr.quiet.from(state) };
      if (evt.payload.quiet) quiet[evt.payload.clientId] = true;
      else delete quiet[evt.payload.clientId];
      return { ...state, ...SpaceQuietRoomAttr.quiet(quiet) };
    }
  );

/**
 * A person is idle when every device of theirs that is in the space and
 * connected has been quiet, and at least one such device is there.
 */
export function memberIsIdle(
  quiet: SpaceQuietMap,
  clientIds: readonly string[]
): boolean {
  const looking = clientIds.filter((id) => isViewingSpaceClient(id));
  return looking.length > 0 && looking.every((id) => quiet[id] === true);
}
