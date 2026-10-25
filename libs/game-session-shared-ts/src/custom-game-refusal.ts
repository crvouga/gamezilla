import type {
  CustomGameChoice,
  CustomGameOperation,
} from './custom-game-choice';
import type { CustomGame } from './custom-game-state';
import {
  customGamePersonSide,
  customGameStartable,
  customGameTerminal,
} from './custom-game-state';

/** How long the other participant must stay away before a claim, in ms. */
export const CUSTOM_GAME_AWAY_CLAIM_MS = 60_000;

/** What the space tells a Custom Game choice about the people in it. */
export type CustomGameRoom = {
  readonly members: readonly string[];
  /** Whether either of two people has blocked the other. */
  readonly restricted: (a: string, b: string) => boolean;
  /** Since when a member has been away, or `null` while present. */
  readonly awaySince: (person: string) => number | null;
  readonly now: number;
};

export const CUSTOM_GAME_CREATOR_OPERATIONS: readonly CustomGameOperation[] = [
  'create',
  'rematch',
  'take',
  'bot',
  'difficulty',
  'local',
  'rules',
  'open',
  'close',
  'invite',
  'revoke',
  'swap',
  'clock',
  'untimed',
  'start',
  'cancel',
];
export const CUSTOM_GAME_SETTING_OPERATIONS: readonly CustomGameOperation[] = [
  'local',
  'rules',
  'take',
  'bot',
  'difficulty',
  'open',
  'close',
  'invite',
  'accept',
  'decline',
  'revoke',
  'claim',
  'release',
  'ready',
  'unready',
  'swap',
  'clock',
  'untimed',
];

function lifecycleRefusal(
  game: CustomGame | null,
  choice: CustomGameChoice
): string {
  if (choice.operation === 'create' || choice.operation === 'rematch') {
    if (game === null)
      return choice.operation === 'rematch' ? 'no finished game' : '';
    return customGameTerminal(game) ? '' : 'finish or cancel first';
  }
  if (game === null) return 'no Custom Game';
  if (game.status === 'completed') return 'finished';
  if (game.status === 'cancelled') return 'cancelled';
  if (
    CUSTOM_GAME_SETTING_OPERATIONS.includes(choice.operation) &&
    game.status !== 'configuring'
  )
    return 'already started';
  return '';
}

function reservedFor(game: CustomGame, person: string): boolean {
  return game.sides.some((side) => game[side].person === person);
}

function claimRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string,
  room: CustomGameRoom
): string {
  if (choice.operation !== 'claim') return '';
  if (room.restricted(game.creator, actor)) return 'side not available';
  const participant = game[choice.side];
  if (participant.kind !== 'open')
    return participant.kind === 'person' && participant.person === actor
      ? ''
      : 'not an open place';
  return reservedFor(game, actor) ? 'one side per person' : '';
}

function invitationRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  room: CustomGameRoom
): string {
  const participant = 'side' in choice ? game[choice.side] : null;
  if (choice.operation === 'invite') {
    if (!room.members.includes(choice.person)) return 'person not in the space';
    if (room.restricted(game.creator, choice.person))
      return 'cannot be invited';
    if (
      reservedFor(game, choice.person) &&
      participant?.person !== choice.person
    )
      return 'one side per person';
  }
  return '';
}

function relationshipRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string,
  room: CustomGameRoom
): string {
  const participant = 'side' in choice ? game[choice.side] : null;
  if (
    choice.operation === 'take' &&
    reservedFor(game, actor) &&
    participant?.person !== actor
  )
    return 'one side per person';
  const invitation = invitationRefusal(game, choice, room);
  if (invitation !== '') return invitation;
  if (
    (choice.operation === 'accept' || choice.operation === 'decline') &&
    (participant?.kind !== 'invitation' || participant.person !== actor)
  )
    return 'not your invitation';
  if (choice.operation === 'revoke' && participant?.kind !== 'invitation')
    return 'no invitation';
  const claim = claimRefusal(game, choice, actor, room);
  if (claim !== '') return claim;
  if (
    choice.operation === 'release' &&
    (participant?.kind !== 'person' || participant.person !== actor)
  )
    return 'not your side';
  if (
    [
      'ready',
      'unready',
      'resign',
      'offer',
      'claimWin',
      'commit',
      'reclaim',
    ].includes(choice.operation) &&
    customGamePersonSide(game, actor) === null
  )
    return 'not a participant';
  return '';
}

function startRefusal(game: CustomGame, choice: CustomGameChoice): string {
  if (choice.operation !== 'start' || game.status !== 'configuring') return '';
  if (
    !game.sides.every(
      (side) =>
        game[side].kind === 'person' ||
        game[side].kind === 'bot' ||
        game[side].kind === 'local'
    )
  )
    return game.sides.length === 2
      ? 'both sides need participants'
      : 'every side needs a participant';
  return customGameStartable(game) ? '' : 'every person must be ready';
}

/** A participant other than the creator cancels only a two-person game, early. */
export function customGameCancelRefusal(
  game: CustomGame,
  actor: string
): string {
  if (game.creator === actor) return '';
  if (
    game.status !== 'active' ||
    game.sides.length !== 2 ||
    !game.sides.every((side) => game[side].kind === 'person')
  )
    return 'only the creator';
  return game.moves.length >= game.sides.length ? 'resign instead' : '';
}

/** The win is claimed only once the other participant has stayed away long enough. */
function claimWinRefusal(
  game: CustomGame,
  actor: string,
  room: CustomGameRoom
): string {
  const side = customGamePersonSide(game, actor);
  if (side === null) return 'not a participant';
  if (game.sides.length > 2) return 'may still return';
  return game.sides
    .filter((other) => other !== side)
    .some((other) => {
      const participant = game[other];
      const since =
        participant.kind === 'person'
          ? room.awaySince(participant.person)
          : null;
      return since !== null && room.now - since >= CUSTOM_GAME_AWAY_CLAIM_MS;
    })
    ? ''
    : 'may still return';
}

function drawOfferRefusal(game: CustomGame, choice: CustomGameChoice): string {
  if (
    choice.operation !== 'offer' ||
    game.sides.every((side) => game[side].kind === 'person')
  )
    return '';
  return game.sides.length === 2
    ? 'draw agreement needs two people'
    : 'draw agreement needs every participant to be a person';
}

function playRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string,
  room: CustomGameRoom
): string {
  if (
    [
      'resign',
      'offer',
      'agree',
      'reject',
      'move',
      'claimWin',
      'commit',
      'reclaim',
    ].includes(choice.operation) &&
    game.status !== 'active'
  )
    return 'not started';
  const draw = drawOfferRefusal(game, choice);
  if (draw !== '') return draw;
  if (choice.operation === 'offer' && game.declinedOffers.includes(actor))
    return 'offer again after moving';
  if (choice.operation === 'cancel')
    return customGameCancelRefusal(game, actor);
  if (choice.operation === 'claimWin')
    return claimWinRefusal(game, actor, room);
  if (
    (choice.operation === 'agree' || choice.operation === 'reject') &&
    (customGamePersonSide(game, actor) === null ||
      game.drawOfferedBy === '' ||
      game.drawOfferedBy === actor)
  )
    return 'not the other participant';
  const start = startRefusal(game, choice);
  if (start !== '') return start;
  return turnRefusal(game, choice, actor);
}

/**
 * A move needs the turn, and a commitment the side's own open choice; a side
 * a stand-in plays is the stand-in's alone until its person takes it back,
 * and a stale ply names a board that changed.
 */
function turnRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string
): string {
  const side = customGamePersonSide(game, actor);
  if (choice.operation === 'reclaim')
    return side !== null && game.standIns.includes(side)
      ? ''
      : 'no stand-in plays your side';
  if (choice.operation !== 'move' && choice.operation !== 'commit') return '';
  if (side !== null && game.standIns.includes(side))
    return 'a stand-in plays your side';
  if (choice.operation === 'commit') {
    if (side === null) return 'not a participant';
    if (game.committed.includes(side)) return 'already chosen';
    if (!game.awaiting.includes(side)) return 'nothing to choose now';
  } else {
    if (game.awaiting.length > 0) return 'every side chooses first';
    if (game[game.turn].kind !== 'person' || game[game.turn].person !== actor)
      return 'only the participant to move may play';
  }
  return choice.ply === game.moves.length ? '' : 'board changed';
}

/** Only the creator makes the creator's choices, however connected they are. */
export function customGameCreatorRefusal(
  game: CustomGame | null,
  choice: CustomGameChoice,
  actor: string
): string {
  if (
    game !== null &&
    CUSTOM_GAME_CREATOR_OPERATIONS.includes(choice.operation) &&
    game.creator !== actor &&
    !(
      choice.operation === 'cancel' &&
      customGamePersonSide(game, actor) !== null
    )
  )
    return 'only the creator';
  return '';
}

export function customGameRefusal(
  game: CustomGame | null,
  choice: CustomGameChoice,
  actor: string,
  room: CustomGameRoom
): string {
  if (!room.members.includes(actor)) return 'not in the space';
  const creator = customGameCreatorRefusal(game, choice, actor);
  if (creator !== '') return creator;
  const lifecycle = lifecycleRefusal(game, choice);
  if (lifecycle !== '') return lifecycle;
  if (choice.gameId !== (game?.id ?? null)) return 'choices changed';
  if (game === null) return '';
  if (
    (CUSTOM_GAME_SETTING_OPERATIONS.includes(choice.operation) ||
      choice.operation === 'start' ||
      choice.operation === 'cancel') &&
    choice.revision !== game.revision
  )
    return 'choices changed';
  if ('side' in choice && !game.sides.includes(choice.side))
    return 'side not available';
  const relationship = relationshipRefusal(game, choice, actor, room);
  if (relationship !== '') return relationship;
  if (
    choice.operation === 'clock' &&
    (!Number.isInteger(choice.minutes) ||
      choice.minutes < 1 ||
      choice.minutes > 180 ||
      !Number.isInteger(choice.increment) ||
      choice.increment < 0 ||
      choice.increment > 60)
  )
    return 'invalid time choice';
  return playRefusal(game, choice, actor, room);
}
