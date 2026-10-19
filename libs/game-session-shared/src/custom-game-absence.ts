import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared/durable-names';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared/space-members-messages';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';
import type { RoomState } from '@pkgs/room-root-shared/types';
import { z } from 'zod';

export const customGameAbsenceSchema = z
  .object({
    pausedAt: z.number().nullable(),
    shifts: z.record(
      z.string(),
      z
        .object({
          since: z.number(),
          pausedMs: z.number().nonnegative(),
        })
        .strict()
    ),
  })
  .strict();
const ns = createAttrNamespace(GAME_PLATFORM_NAMESPACE, 'custom');
export const CustomGameAbsenceAttr = ns.json('absence-pause', (value) =>
  value === undefined
    ? { pausedAt: null, shifts: {} }
    : customGameAbsenceSchema.parse(value)
);

/** A shift belongs to one uninterrupted absence, never a later departure. */
export function customGameAwaySince(
  state: RoomState,
  person: string
): number | null {
  const since = SpaceMembersRoomAttr.away.from(state)[person];
  if (since === undefined) return null;
  const shift = CustomGameAbsenceAttr.from(state).shifts[person];
  return since + (shift?.since === since ? shift.pausedMs : 0);
}

/** Retain only the part of each current absence spent outside shared pauses. */
export function changeCustomGameAbsence(
  state: RoomState,
  available: boolean,
  now: number
) {
  const previous = CustomGameAbsenceAttr.from(state);
  if (!available) return { ...previous, pausedAt: now };
  if (previous.pausedAt === null) return previous;
  const shifts: z.infer<typeof customGameAbsenceSchema>['shifts'] = {};
  for (const [person, since] of Object.entries(
    SpaceMembersRoomAttr.away.from(state)
  )) {
    const old = previous.shifts[person];
    shifts[person] = {
      since,
      pausedMs:
        (old?.since === since ? old.pausedMs : 0) +
        Math.max(0, now - Math.max(since, previous.pausedAt)),
    };
  }
  return { pausedAt: null, shifts };
}
