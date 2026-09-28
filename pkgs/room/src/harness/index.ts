/**
 * Harness-only entry of `@pkgs/room`: the one example app every test of the
 * room framework drives (docs/TESTING.md, "One example app per package").
 * `@pkgs/room-harness` runs it in rooms; `@pkgs/room`'s and the adapters'
 * own tests use its module directly, since they sit below the harness.
 */

export {
  AddOne,
  ClaimOutOfTime,
  ClaimRoom,
  gameRoomModule,
  MATCH_STATUS,
  MatchStarted,
  type MatchStatus,
  Move,
  Moved,
  type Player,
  RanOutOfTime,
  REFUSAL,
  RoomClaimed,
  readMatchStatus,
  readOwner,
  readPlayerToMove,
  readTally,
  readTimeLeftSeconds,
  readTurnedAway,
  readWinner,
  StartMatch,
  TakeOne,
  TallyChanged,
  TurnAway,
  TurnedAway,
} from './example-app/game-room';
