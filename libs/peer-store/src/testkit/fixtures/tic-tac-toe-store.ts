import { Assert } from '@gamezilla/lib/assert';
import { createMessageRouter } from '@gamezilla/lib/message';
import type { Command, HandleResult, State, StoreModule } from '../../store/types';
import type { Event } from '../../events/message-types';
import {
  ClockSliceSet,
  ClockTimeout,
  GameDrawn,
  GameWon,
  JoinSession,
  LeaveSession,
  MarkPlaced,
  PlaceMark,
  PlayerResigned,
  Resign,
  SeatClaimed,
  SeatReleased,
  TickClock,
  ForfeitWin,
  cmdNs,
  evtNs,
  reject,
  UnknownCommandError,
} from './tic-tac-toe-messages';
import {
  handleJoinSession,
  handleLeaveSession,
  handlePlaceMark,
  handleResign,
  handleTickClock,
} from './tic-tac-toe-handlers';
import {
  reduceClockSliceSet,
  reduceClockTimeout,
  reduceForfeitWin,
  reduceGameDrawn,
  reduceGameWon,
  reduceMarkPlaced,
  reducePlayerResigned,
  reduceSeatClaimed,
  reduceSeatReleased,
} from './tic-tac-toe-reduce';

const crash: Assert = Assert.crash();

const commandRouter = createMessageRouter<State, Command, HandleResult>(cmdNs)
  .on(PlaceMark, (state, command, msg) => handlePlaceMark(state, command, msg))
  .on(Resign, (state, command, msg) => handleResign(state, command, msg))
  .on(JoinSession, (state, command, msg) =>
    handleJoinSession(state, command, msg)
  )
  .on(TickClock, (state, _command, msg) => handleTickClock(state, msg))
  .on(LeaveSession, (state, command) => handleLeaveSession(state, command));

const eventRouter = createMessageRouter<State, void, State>(evtNs)
  .on(MarkPlaced, (state, _, msg) => reduceMarkPlaced(state, msg))
  .on(GameWon, (state, _, msg) => reduceGameWon(state, msg))
  .on(GameDrawn, (state, _, msg) => reduceGameDrawn(state, msg))
  .on(PlayerResigned, (state, _, msg) => reducePlayerResigned(state, msg))
  .on(SeatClaimed, (state, _, msg) => reduceSeatClaimed(state, msg))
  .on(SeatReleased, (state, _, msg) => reduceSeatReleased(state, msg))
  .on(ForfeitWin, (state, _, msg) => reduceForfeitWin(state, msg))
  .on(ClockSliceSet, (state, _, msg) => reduceClockSliceSet(state, msg))
  .on(ClockTimeout, (state, _, msg) => reduceClockTimeout(state, msg));

export const TicTacToeModule: StoreModule = {
  initialState(): State {
    return {
      board: [null, null, null, null, null, null, null, null, null],
      currentTurn: 'X',
      winner: null,
      status: 'in_progress',
      seq: 0,
      seatX: null,
      seatO: null,
      clockStatus: 'idle',
      remainingMsX: 0,
      remainingMsO: 0,
      clockActivePlayer: null,
    };
  },

  handle(state: State, command: Command): HandleResult {
    crash.defined(state, 'state must be defined');
    crash.defined(command, 'command must be defined');
    crash.nonEmptyString(
      command.message.type,
      'command message type must be non-empty'
    );

    return commandRouter.dispatch(
      state,
      command,
      command.message,
      (_s, _c, msg) => reject(UnknownCommandError({ commandType: msg.type }))
    );
  },

  reduce(state: State, event: Event): State {
    crash.defined(state, 'state must be defined');
    crash.defined(event, 'event must be defined');

    return eventRouter.dispatch(state, undefined, event, (s) => s);
  },
};
