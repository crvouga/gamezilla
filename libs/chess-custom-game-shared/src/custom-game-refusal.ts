import type {
  CustomGameChoice,
  CustomGameOperation,
} from './custom-game-choice';
import type { CustomGame } from './custom-game-state';
import {
  CUSTOM_GAME_SIDES,
  customGamePersonSide,
  customGameStartable,
  customGameTerminal,
} from './custom-game-state';

export const CUSTOM_GAME_CREATOR_OPERATIONS: readonly CustomGameOperation[] = [
  'create',
  'rematch',
  'take',
  'bot',
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
  'take',
  'bot',
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
  return CUSTOM_GAME_SIDES.some((side) => game[side].person === person);
}

function claimRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string
): string {
  if (choice.operation !== 'claim') return '';
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
  members: readonly string[]
): string {
  const participant = 'side' in choice ? game[choice.side] : null;
  if (choice.operation === 'invite') {
    if (!members.includes(choice.person)) return 'person not in the space';
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
  members: readonly string[]
): string {
  const participant = 'side' in choice ? game[choice.side] : null;
  if (
    choice.operation === 'take' &&
    reservedFor(game, actor) &&
    participant?.person !== actor
  )
    return 'one side per person';
  const invitation = invitationRefusal(game, choice, members);
  if (invitation !== '') return invitation;
  if (
    (choice.operation === 'accept' || choice.operation === 'decline') &&
    (participant?.kind !== 'invitation' || participant.person !== actor)
  )
    return 'not your invitation';
  if (choice.operation === 'revoke' && participant?.kind !== 'invitation')
    return 'no invitation';
  const claim = claimRefusal(game, choice, actor);
  if (claim !== '') return claim;
  if (
    choice.operation === 'release' &&
    (participant?.kind !== 'person' || participant.person !== actor)
  )
    return 'not your side';
  if (
    ['ready', 'unready', 'resign', 'offer'].includes(choice.operation) &&
    customGamePersonSide(game, actor) === null
  )
    return 'not a participant';
  return '';
}

function startRefusal(game: CustomGame, choice: CustomGameChoice): string {
  if (choice.operation !== 'start' || game.status !== 'configuring') return '';
  if (
    !CUSTOM_GAME_SIDES.every(
      (side) => game[side].kind === 'person' || game[side].kind === 'bot'
    )
  )
    return 'both sides need participants';
  return customGameStartable(game) ? '' : 'every person must be ready';
}

function playRefusal(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string
): string {
  if (
    ['resign', 'offer', 'agree', 'reject', 'move'].includes(choice.operation) &&
    game.status !== 'active'
  )
    return 'not started';
  if (
    choice.operation === 'offer' &&
    (game.white.kind !== 'person' || game.black.kind !== 'person')
  )
    return 'draw agreement needs two people';
  if (
    (choice.operation === 'agree' || choice.operation === 'reject') &&
    (customGamePersonSide(game, actor) === null ||
      game.drawOfferedBy === '' ||
      game.drawOfferedBy === actor)
  )
    return 'not the other participant';
  const start = startRefusal(game, choice);
  if (start !== '') return start;
  if (choice.operation === 'move') {
    if (game[game.turn].kind !== 'person' || game[game.turn].person !== actor)
      return 'only the participant to move may play';
    if (choice.ply !== game.moves.length) return 'board changed';
  }
  return '';
}

export function customGameRefusal(
  game: CustomGame | null,
  choice: CustomGameChoice,
  actor: string,
  members: readonly string[]
): string {
  if (!members.includes(actor)) return 'not in the space';
  if (
    game !== null &&
    CUSTOM_GAME_CREATOR_OPERATIONS.includes(choice.operation) &&
    game.creator !== actor
  )
    return 'only the creator';
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
  const relationship = relationshipRefusal(game, choice, actor, members);
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
  return playRefusal(game, choice, actor);
}
