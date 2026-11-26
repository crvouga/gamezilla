/**
 * What a viewer can do to one entry of a space's people row, built fresh
 * from four things: who was pressed, who is pressing, the phase, and the
 * game. Pure, so every combination is checked without rendering.
 *
 * Order: the game's actions, then the space's, then the host's own; every
 * destructive action after the rest, in that same order. An action the
 * viewer cannot take is left out, never shown disabled, and so is an
 * action the product cannot carry out yet (`SpacePersonCapability`).
 */

import type {
  SpaceGameAction,
  SpacePerson,
  SpacePhase,
  SpaceRole,
} from './space-types';

/** The space's own person actions; their words live in `SpacePersonSheet`. */
export type SpacePersonActionId =
  | 'readyUp'
  | 'notReady'
  | 'muteMic'
  | 'mute'
  | 'seeMyDetails'
  | 'leaveSeat'
  | 'sendMessage'
  | 'seeDetails'
  | 'makeHost'
  | 'removeFromSpace'
  | 'changeDifficulty'
  | 'swapForPerson'
  | 'removeBot'
  | 'removeSeat'
  | 'inviteFriend'
  | 'addBot';

/**
 * Space actions shown only when the caller says the product can carry them
 * out; each is hidden until then, never shown disabled.
 */
export type SpacePersonCapability =
  | 'makeHost'
  | 'mute'
  | 'muteMic'
  | 'sendMessage'
  | 'seeDetails'
  | 'seeMyDetails';

/** Every capability, for a caller (a story) that can do them all. */
export const SPACE_PERSON_CAPABILITIES: readonly SpacePersonCapability[] = [
  'makeHost',
  'mute',
  'muteMic',
  'sendMessage',
  'seeDetails',
  'seeMyDetails',
];

/** One row of a person's sheet. */
export type SpacePersonActionEntry =
  | {
      source: 'space';
      id: SpacePersonActionId;
      destructive: boolean;
      /** A toggle's state, said as a word (On, Off). */
      on?: boolean | undefined;
    }
  | { source: 'game'; action: SpaceGameAction; destructive: boolean };

export type SpacePersonActionsInput = {
  pressed: SpacePerson;
  viewer: SpaceRole;
  phase: SpacePhase;
  /** The game's actions on this entry (`SpaceGamePlay.personActions`). */
  game?: readonly SpaceGameAction[] | undefined;
  /** The optional actions the product can carry out; none by default. */
  capabilities?: readonly SpacePersonCapability[] | undefined;
};

const DESTRUCTIVE: ReadonlySet<SpacePersonActionId> =
  new Set<SpacePersonActionId>([
    'leaveSeat',
    'removeFromSpace',
    'removeBot',
    'removeSeat',
  ]);

const OPTIONAL: ReadonlySet<SpacePersonActionId> = new Set<SpacePersonActionId>(
  SPACE_PERSON_CAPABILITIES
);

function available(
  id: SpacePersonActionId,
  capabilities: readonly SpacePersonCapability[]
): boolean {
  return (
    !OPTIONAL.has(id) || capabilities.some((capability) => capability === id)
  );
}

function own(input: SpacePersonActionsInput): SpacePersonActionId[] {
  const ids: SpacePersonActionId[] = [];
  if (input.phase === 'settingUp' && input.viewer === 'guest') {
    ids.push(input.pressed.status === 'ready' ? 'notReady' : 'readyUp');
  }
  ids.push('muteMic', 'seeMyDetails');
  if (input.phase !== 'choosing') ids.push('leaveSeat');
  return ids;
}

function anyone(input: SpacePersonActionsInput): SpacePersonActionId[] {
  const kind = input.pressed.kind;
  if (kind === 'openSeat') return ['inviteFriend'];
  if (kind === 'bot' || kind === 'remote') return ['seeDetails'];
  return ['sendMessage', 'mute', 'seeDetails'];
}

function hostOnly(input: SpacePersonActionsInput): SpacePersonActionId[] {
  if (input.viewer !== 'host' || input.pressed.you === true) return [];
  const kind = input.pressed.kind;
  if (kind === 'remote') return [];
  if (kind === 'openSeat') return ['addBot', 'removeSeat'];
  if (kind === 'bot') {
    return ['changeDifficulty', 'swapForPerson', 'removeBot', 'removeSeat'];
  }
  return ['makeHost', 'removeFromSpace'];
}

function spaceEntry(
  id: SpacePersonActionId,
  pressed: SpacePerson
): SpacePersonActionEntry {
  const toggle = id === 'mute' || id === 'muteMic';
  return {
    source: 'space',
    id,
    destructive: DESTRUCTIVE.has(id),
    on: toggle ? pressed.muted === true : undefined,
  };
}

/** Every action the viewer has on the pressed entry, in sheet order. */
export function spacePersonActions(
  input: SpacePersonActionsInput
): readonly SpacePersonActionEntry[] {
  const game: SpacePersonActionEntry[] = (input.game ?? []).map((action) => ({
    source: 'game',
    action,
    destructive: action.tone === 'destructive',
  }));
  const capabilities = input.capabilities ?? [];
  const ids = (
    input.pressed.you === true
      ? own(input)
      : [...anyone(input), ...hostOnly(input)]
  ).filter((id) => available(id, capabilities));
  const all = [...game, ...ids.map((id) => spaceEntry(id, input.pressed))];
  return [
    ...all.filter((entry) => !entry.destructive),
    ...all.filter((entry) => entry.destructive),
  ];
}
