import { t } from '@lingui/core/macro';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import type {
  SpacePerson,
  SpacePersonData,
  SpacePersonKind,
  SpacePersonStatus,
} from '@pkgs/ui-root-client-ts/space-types';
import type { FrameSetup, FrameSetupSeat } from './game-frame-view-types';

/**
 * The people row while a custom game is set up: one cell per seat (a
 * person, an invitation, a bot, a player on this device, an open or closed
 * seat), then everyone else in the space, watching. Pure, so every seat
 * and every viewer is checked without rendering.
 */

const SEAT_ID = 'seat:';

/** The people-row id of `side`'s seat: a seat, not the person in it. */
export function frameSeatPersonId(side: GameSide): string {
  return `${SEAT_ID}${side}`;
}

/** The seat a people-row id names, or `undefined` for a watcher. */
export function frameSeatOf(
  setup: FrameSetup,
  id: string
): FrameSetupSeat | undefined {
  if (!id.startsWith(SEAT_ID)) return undefined;
  const side = id.slice(SEAT_ID.length);
  return setup.seats.find((seat) => seat.side === side);
}

/** The handle of a seat's cell; pressing it opens the seat's actions. */
export function frameSeatTestId(side: GameSide): string {
  return `custom-game-${side}-choices`;
}

/** The person a seat holds or invites, by profile id. */
export function frameSeatHolder(seat: FrameSetupSeat): string | null {
  const holder = seat.holder;
  return holder.kind === 'person' || holder.kind === 'invitation'
    ? holder.person
    : null;
}

/** The viewer's own invitation to the seat, still to answer. */
export function frameOwnInvitation(seat: FrameSetupSeat): boolean {
  return seat.invitation?.mine === true && seat.invitation.canAnswer;
}

function seatKind(seat: FrameSetupSeat): SpacePersonKind {
  switch (seat.holder.kind) {
    case 'person':
    case 'invitation':
      return 'person';
    case 'bot':
      return 'bot';
    case 'local':
      return 'remote';
    default:
      return 'openSeat';
  }
}

/**
 * A person says whether they are ready; an invitation waits on its
 * answer. A bot or a player on this device is ready by itself and never
 * what the game waits for, so its cell says nothing about it.
 */
function seatStatus(seat: FrameSetupSeat): SpacePersonStatus | undefined {
  const kind = seat.holder.kind;
  if (kind === 'invitation') return 'notReady';
  if (kind !== 'person') return undefined;
  return seat.ready ? 'ready' : 'notReady';
}

/** The sheet's space actions on a seat, under the seat's own handles. */
function seatActionTestIds(
  seat: FrameSetupSeat
): Readonly<Partial<Record<string, string>>> {
  const side = seat.side;
  return {
    addBot: `custom-game-${side}-bot`,
    removeBot: `custom-game-${side}-open`,
    removeSeat: `custom-game-${side}-close`,
    changeDifficulty: `custom-game-${side}-difficulty`,
    leaveSeat: frameOwnInvitation(seat)
      ? undefined
      : `custom-game-${side}-release`,
  };
}

/** One seat as a cell of the people row. */
function seatPerson(
  seat: FrameSetupSeat,
  present: readonly SpacePerson[]
): SpacePerson {
  const holder = frameSeatHolder(seat);
  const face = present.find((person) => person.id === holder);
  const initials = avatarInitials(seat.plainName);
  return {
    id: frameSeatPersonId(seat.side),
    kind: seatKind(seat),
    name: face === undefined || face.name === '' ? seat.plainName : face.name,
    you: seat.own || seat.invitation?.mine === true,
    host: face?.host === true || seat.host,
    status: seatStatus(seat),
    initials: face?.initials ?? (initials.length > 0 ? initials : undefined),
    tintKey: holder ?? seat.side,
    svg: face?.svg,
    testId: frameSeatTestId(seat.side),
    actionTestIds: seatActionTestIds(seat),
  };
}

/** Every seat of the game, in seat order. */
export function frameSeatPeople(
  setup: FrameSetup,
  present: readonly SpacePerson[]
): readonly SpacePerson[] {
  return setup.seats.map((seat) => seatPerson(seat, present));
}

/**
 * Everyone in the space who neither holds a seat nor is invited to one,
 * in the space's order: they watch.
 */
export function frameWatchers(
  setup: FrameSetup | null,
  present: readonly SpacePerson[]
): readonly SpacePerson[] {
  const seated = new Set(
    (setup?.seats ?? []).map(frameSeatHolder).filter((id) => id !== null)
  );
  return present.filter((person) => !seated.has(person.id));
}

/**
 * A seat's data line: its side's look and its clock, or that its
 * invitation waits; said in words for listeners and the person's sheet.
 */
export function frameSeatData(
  setup: FrameSetup,
  person: SpacePerson
): SpacePersonData | undefined {
  const seat = frameSeatOf(setup, person.id);
  if (seat === undefined) return undefined;
  const side = seat.sideLabel;
  const clock = seat.clock?.value;
  const invited = seat.holder.kind === 'invitation';
  const description =
    clock === undefined
      ? t`playing ${side}`
      : t`playing ${side}, ${clock} on the clock`;
  return {
    swatch: seat.swatch,
    value: invited ? t`Invited` : clock,
    description: invited ? t`invited to play ${side}` : description,
  };
}

const DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * The level after the bot's own, among those the game offers: changing a
 * bot's difficulty steps through them and back to the first.
 */
export function frameNextDifficulty(
  seat: FrameSetupSeat
): BotDifficulty | null {
  const offered = seat.choices?.difficulties ?? [];
  const levels = DIFFICULTIES.filter((level) => offered.includes(level));
  if (levels.length === 0) return null;
  const at = levels.indexOf(seat.choices?.difficulty ?? levels[0] ?? 'easy');
  return levels[(at + 1) % levels.length] ?? null;
}
