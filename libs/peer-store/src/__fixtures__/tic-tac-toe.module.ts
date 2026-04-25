import { Assert } from '@gamezilla/lib/assert'
import {
  createMessageRouter,
  createNamespace,
  isPlainRecord,
  type Message,
} from '@gamezilla/lib/message'
import type {
  Command,
  Event,
  HandleResult,
  State,
  StoreModule,
} from '../types'

const crash: Assert = Assert.crash()

function isMark(v: unknown): v is 'X' | 'O' {
  return v === 'X' || v === 'O'
}

function isCellIndex(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= 0 &&
    v <= 8
  )
}

function isLogSeq(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isNonEmptyPeerId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function validatePlaceMarkPayload(
  p: unknown,
): p is { cell: number; player: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false
  return isCellIndex(p['cell']) && isMark(p['player'])
}

function validateResignPayload(p: unknown): p is { player: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false
  return isMark(p['player'])
}

function validateJoinSessionPayload(p: unknown): p is { mark: 'X' | 'O' } {
  if (!isPlainRecord(p)) return false
  return isMark(p['mark'])
}

function validateLeaveSessionPayload(
  p: unknown,
): p is Record<string, never> {
  return isPlainRecord(p) && Object.keys(p).length === 0
}

function validateMarkPlacedPayload(
  p: unknown,
): p is { cell: number; player: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false
  return (
    isCellIndex(p['cell']) &&
    isMark(p['player']) &&
    isLogSeq(p['seq'])
  )
}

function validateGameWonPayload(
  p: unknown,
): p is { winner: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false
  return isMark(p['winner']) && isLogSeq(p['seq'])
}

function validateGameDrawnPayload(p: unknown): p is { seq: number } {
  if (!isPlainRecord(p)) return false
  return isLogSeq(p['seq'])
}

function validatePlayerResignedPayload(
  p: unknown,
): p is { player: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false
  return isMark(p['player']) && isLogSeq(p['seq'])
}

function validateSeatClaimedPayload(
  p: unknown,
): p is { mark: 'X' | 'O'; peerId: string; seq: number } {
  if (!isPlainRecord(p)) return false
  return (
    isMark(p['mark']) &&
    isNonEmptyPeerId(p['peerId']) &&
    isLogSeq(p['seq'])
  )
}

function validateSeatReleasedPayload(
  p: unknown,
): p is { mark: 'X' | 'O'; peerId: string; seq: number } {
  if (!isPlainRecord(p)) return false
  return (
    isMark(p['mark']) &&
    isNonEmptyPeerId(p['peerId']) &&
    isLogSeq(p['seq'])
  )
}

function validateForfeitWinPayload(
  p: unknown,
): p is { winner: 'X' | 'O'; seq: number } {
  if (!isPlainRecord(p)) return false
  return isMark(p['winner']) && isLogSeq(p['seq'])
}

const cmdNs = createNamespace('ticTacToe')
export const PlaceMark = cmdNs('PLACE_MARK', validatePlaceMarkPayload)
export const Resign = cmdNs('RESIGN', validateResignPayload)
export const JoinSession = cmdNs('JOIN_SESSION', validateJoinSessionPayload)
export const LeaveSession = cmdNs('LEAVE_SESSION', validateLeaveSessionPayload)

const evtNs = createNamespace('ticTacToeEvent')
export const MarkPlaced = evtNs('MARK_PLACED', validateMarkPlacedPayload)
export const GameWon = evtNs('GAME_WON', validateGameWonPayload)
export const GameDrawn = evtNs('GAME_DRAWN', validateGameDrawnPayload)
export const PlayerResigned = evtNs(
  'PLAYER_RESIGNED',
  validatePlayerResignedPayload,
)
export const SeatClaimed = evtNs('SEAT_CLAIMED', validateSeatClaimedPayload)
export const SeatReleased = evtNs('SEAT_RELEASED', validateSeatReleasedPayload)
export const ForfeitWin = evtNs('FORFEIT_WIN', validateForfeitWinPayload)

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const

function checkWinner(board: Array<null | string>): null | string {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return board[a]!
    }
  }
  return null
}

function isBoardFull(board: Array<null | string>): boolean {
  return board.every((cell) => cell !== null)
}

function readBoard(state: State): unknown[] {
  crash.field(state, 'board', 'state must have board')
  crash.array(state['board'], 'board must be an array')
  const b = state['board']
  crash.ok(b.length === 9, 'board must have 9 cells')
  return b
}

function readSeat(
  state: State,
  key: 'seatX' | 'seatO',
  label: string,
): null | string {
  crash.field(state, key, `state must have ${label}`)
  const v = state[key]
  if (v === null) {
    return null
  }
  crash.string(v, `${label} must be string or null`)
  crash.nonEmptyString(v, `${label} must be non-empty when set`)
  return v
}

function seatsFullyClaimed(state: State): boolean {
  const x = readSeat(state, 'seatX', 'seatX')
  const o = readSeat(state, 'seatO', 'seatO')
  return x !== null && o !== null
}

function assertValidState(state: State): void {
  readBoard(state)
  readSeat(state, 'seatX', 'seatX')
  readSeat(state, 'seatO', 'seatO')
  crash.field(state, 'currentTurn', 'state must have currentTurn')
  crash.ok(
    state['currentTurn'] === 'X' || state['currentTurn'] === 'O',
    'currentTurn must be X or O',
  )
  crash.field(state, 'status', 'state must have status')
  crash.ok(
    state['status'] === 'in_progress' || state['status'] === 'completed',
    'status must be in_progress or completed',
  )
  crash.field(state, 'seq', 'state must have seq')
}

function assertPeerOwnsMark(
  state: State,
  command: Command,
  player: 'X' | 'O',
): HandleResult | null {
  if (!seatsFullyClaimed(state)) {
    return null
  }
  const seatKey = player === 'X' ? 'seatX' : 'seatO'
  const expected = readSeat(state, seatKey, seatKey)
  if (expected !== command.peerId) {
    return err(
      'NOT_YOUR_MARK',
      `peer ${command.peerId} cannot act as ${player}`,
    )
  }
  return null
}

function err(code: string, message: string): HandleResult {
  return { ok: false, error: { code, message } }
}

function handlePlaceMark(
  state: State,
  command: Command,
  msg: Message<{ cell: number; player: 'X' | 'O' }>,
): HandleResult {
  assertValidState(state)

  const cell = msg.payload.cell
  const player = msg.payload.player

  if (
    typeof cell !== 'number' ||
    cell < 0 ||
    cell > 8 ||
    !Number.isInteger(cell)
  ) {
    return err(
      'INVALID_CELL',
      `cell must be integer 0-8, got: ${String(cell)}`,
    )
  }
  if (player !== 'X' && player !== 'O') {
    return err(
      'INVALID_PLAYER',
      `player must be X or O, got: ${String(player)}`,
    )
  }
  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'game is already completed')
  }
  if (state['currentTurn'] !== player) {
    return err('WRONG_TURN', `not ${String(player)}'s turn`)
  }

  const seatErr = assertPeerOwnsMark(state, command, player)
  if (seatErr !== null) {
    return seatErr
  }

  const boardUnknown = readBoard(state)
  const boardCells: Array<null | string> = []
  for (let i = 0; i < 9; i++) {
    const c = boardUnknown[i]
    if (c !== null && c !== 'X' && c !== 'O') {
      return err('INVALID_BOARD', 'board cell must be null, X, or O')
    }
    boardCells.push(c)
  }
  if (boardCells[cell] !== null) {
    return err('CELL_OCCUPIED', `cell ${cell} is already occupied`)
  }

  const seqRaw = state['seq']
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number')
  }
  const next_seq = seqRaw + 1
  const events: Event[] = [MarkPlaced({ cell, player, seq: next_seq })]

  const next_board = [...boardCells]
  next_board[cell] = player
  const winner = checkWinner(next_board)

  if (winner === 'X' || winner === 'O') {
    events.push(GameWon({ winner, seq: next_seq + 1 }))
  } else if (isBoardFull(next_board)) {
    events.push(GameDrawn({ seq: next_seq + 1 }))
  }

  return { ok: true, value: { events } }
}

function handleResign(
  state: State,
  command: Command,
  msg: Message<{ player: 'X' | 'O' }>,
): HandleResult {
  assertValidState(state)

  const player = msg.payload.player

  if (player !== 'X' && player !== 'O') {
    return err(
      'INVALID_PLAYER',
      `player must be X or O, got: ${String(player)}`,
    )
  }
  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'game is already completed')
  }

  const seatErr = assertPeerOwnsMark(state, command, player)
  if (seatErr !== null) {
    return seatErr
  }

  const seqRaw = state['seq']
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number')
  }
  const next_seq = seqRaw + 1
  return {
    ok: true,
    value: {
      events: [PlayerResigned({ player, seq: next_seq })],
    },
  }
}

function handleJoinSession(
  state: State,
  command: Command,
  msg: Message<{ mark: 'X' | 'O' }>,
): HandleResult {
  assertValidState(state)

  const mark = msg.payload.mark

  if (mark !== 'X' && mark !== 'O') {
    return err('INVALID_MARK', `mark must be X or O, got: ${String(mark)}`)
  }

  if (state['status'] === 'completed') {
    return err('GAME_OVER', 'cannot join a completed game')
  }

  const seatX = readSeat(state, 'seatX', 'seatX')
  const seatO = readSeat(state, 'seatO', 'seatO')
  const peerId = command.peerId

  const otherSeat = mark === 'X' ? seatO : seatX
  if (otherSeat === peerId) {
    return err('ALREADY_SEATED', 'peer already holds the other mark')
  }

  const mySeat = mark === 'X' ? seatX : seatO
  if (mySeat !== null && mySeat !== peerId) {
    return err('SEAT_TAKEN', `mark ${mark} is already claimed`)
  }

  const seqRaw = state['seq']
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number')
  }
  const next_seq = seqRaw + 1

  return {
    ok: true,
    value: {
      events: [SeatClaimed({ mark, peerId, seq: next_seq })],
    },
  }
}

function handleLeaveSession(state: State, command: Command): HandleResult {
  assertValidState(state)

  const rawPayload = command.message.payload
  if (
    rawPayload === null ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload)
  ) {
    return err(
      'INVALID_PAYLOAD',
      'LEAVE_SESSION payload must be a plain object',
    )
  }

  const seatX = readSeat(state, 'seatX', 'seatX')
  const seatO = readSeat(state, 'seatO', 'seatO')
  const peerId = command.peerId

  const held: Array<'X' | 'O'> = []
  if (seatX === peerId) {
    held.push('X')
  }
  if (seatO === peerId) {
    held.push('O')
  }
  if (held.length === 0) {
    return err('NOT_SEATED', 'peer has no seat to leave')
  }

  const seqRaw = state['seq']
  if (typeof seqRaw !== 'number' || !Number.isFinite(seqRaw)) {
    return err('INVALID_STATE', 'state.seq must be a finite number')
  }

  const events: Event[] = []
  let seq = seqRaw + 1
  for (const mark of held) {
    events.push(SeatReleased({ mark, peerId, seq }))
    seq += 1
  }

  const nextSeatX = held.includes('X') ? null : seatX
  const nextSeatO = held.includes('O') ? null : seatO

  const inProgress = state['status'] === 'in_progress'
  const oneRemains =
    (nextSeatX !== null && nextSeatO === null) ||
    (nextSeatX === null && nextSeatO !== null)
  if (inProgress && oneRemains && seatsFullyClaimed(state)) {
    const winner: 'X' | 'O' =
      nextSeatX !== null && nextSeatO === null ? 'X' : 'O'
    events.push(ForfeitWin({ winner, seq }))
    seq += 1
  }

  return { ok: true, value: { events } }
}

function reduceMarkPlaced(
  state: State,
  msg: Message<{ cell: number; player: 'X' | 'O'; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'MARK_PLACED payload must be a record')
  crash.field(payload, 'cell', 'MARK_PLACED must have cell')
  crash.field(payload, 'player', 'MARK_PLACED must have player')
  crash.field(payload, 'seq', 'MARK_PLACED must have seq')

  const boardSrc = readBoard(state)
  const board: Array<null | string> = []
  for (let i = 0; i < 9; i++) {
    const c = boardSrc[i]
    crash.ok(
      c === null || c === 'X' || c === 'O',
      'board cell must be null, X, or O',
    )
    board.push(c)
  }
  const cell = payload.cell
  const player = payload.player
  crash.number(cell, 'MARK_PLACED cell must be a finite number')
  crash.ok(
    Number.isInteger(cell) && cell >= 0 && cell <= 8,
    'MARK_PLACED cell must be integer 0..8',
  )
  crash.string(player, 'MARK_PLACED player must be string')
  crash.ok(
    player === 'X' || player === 'O',
    'MARK_PLACED player must be X or O',
  )
  board[cell] = player

  const next_turn = player === 'X' ? 'O' : 'X'
  const seqVal = payload.seq
  crash.number(seqVal, 'MARK_PLACED seq must be a finite number')
  const result: State = {
    ...state,
    board,
    currentTurn: next_turn,
    seq: seqVal,
  }

  crash.ok(
    result['currentTurn'] === 'X' || result['currentTurn'] === 'O',
    'reduce postcondition: currentTurn must be X or O',
  )
  return result
}

function reduceGameWon(
  state: State,
  msg: Message<{ winner: 'X' | 'O'; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'GAME_WON payload must be a record')
  crash.field(payload, 'winner', 'GAME_WON must have winner')
  crash.field(payload, 'seq', 'GAME_WON must have seq')
  const seqVal = payload.seq
  crash.number(seqVal, 'GAME_WON seq must be a finite number')

  return {
    ...state,
    winner: payload.winner,
    status: 'completed',
    seq: seqVal,
  }
}

function reduceGameDrawn(state: State, msg: Message<{ seq: number }>): State {
  const payload = msg.payload
  crash.record(payload, 'GAME_DRAWN payload must be a record')
  crash.field(payload, 'seq', 'GAME_DRAWN must have seq')
  const seqVal = payload.seq
  crash.number(seqVal, 'GAME_DRAWN seq must be a finite number')

  return {
    ...state,
    winner: 'draw',
    status: 'completed',
    seq: seqVal,
  }
}

function reducePlayerResigned(
  state: State,
  msg: Message<{ player: 'X' | 'O'; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'PLAYER_RESIGNED payload must be a record')
  crash.field(payload, 'player', 'PLAYER_RESIGNED must have player')
  crash.field(payload, 'seq', 'PLAYER_RESIGNED must have seq')

  const player = payload.player
  crash.string(player, 'PLAYER_RESIGNED player must be string')
  crash.ok(
    player === 'X' || player === 'O',
    'PLAYER_RESIGNED player must be X or O',
  )
  const winner = player === 'X' ? 'O' : 'X'
  const seqVal = payload.seq
  crash.number(seqVal, 'PLAYER_RESIGNED seq must be a finite number')

  return {
    ...state,
    winner,
    status: 'completed',
    seq: seqVal,
  }
}

function reduceSeatClaimed(
  state: State,
  msg: Message<{ mark: 'X' | 'O'; peerId: string; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'SEAT_CLAIMED payload must be a record')
  crash.field(payload, 'mark', 'SEAT_CLAIMED must have mark')
  crash.field(payload, 'peerId', 'SEAT_CLAIMED must have peerId')
  crash.field(payload, 'seq', 'SEAT_CLAIMED must have seq')
  const markRaw = payload.mark
  crash.ok(markRaw === 'X' || markRaw === 'O', 'SEAT_CLAIMED mark must be X or O')
  const mark = markRaw
  crash.string(payload.peerId, 'SEAT_CLAIMED peerId must be string')
  const seqVal = payload.seq
  crash.number(seqVal, 'SEAT_CLAIMED seq must be a finite number')
  const seatKey = mark === 'X' ? 'seatX' : 'seatO'
  return {
    ...state,
    [seatKey]: payload.peerId,
    seq: seqVal,
  }
}

function reduceSeatReleased(
  state: State,
  msg: Message<{ mark: 'X' | 'O'; peerId: string; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'SEAT_RELEASED payload must be a record')
  crash.field(payload, 'mark', 'SEAT_RELEASED must have mark')
  crash.field(payload, 'peerId', 'SEAT_RELEASED must have peerId')
  crash.field(payload, 'seq', 'SEAT_RELEASED must have seq')
  const markRaw = payload.mark
  crash.ok(markRaw === 'X' || markRaw === 'O', 'SEAT_RELEASED mark must be X or O')
  const mark = markRaw
  crash.string(payload.peerId, 'SEAT_RELEASED peerId must be string')
  const seqVal = payload.seq
  crash.number(seqVal, 'SEAT_RELEASED seq must be a finite number')
  const seatKey = mark === 'X' ? 'seatX' : 'seatO'
  const prev = readSeat(state, seatKey, seatKey)
  const cleared = prev === payload.peerId ? null : prev
  return {
    ...state,
    [seatKey]: cleared,
    seq: seqVal,
  }
}

function reduceForfeitWin(
  state: State,
  msg: Message<{ winner: 'X' | 'O'; seq: number }>,
): State {
  const payload = msg.payload
  crash.record(payload, 'FORFEIT_WIN payload must be a record')
  crash.field(payload, 'winner', 'FORFEIT_WIN must have winner')
  crash.field(payload, 'seq', 'FORFEIT_WIN must have seq')
  const w = payload.winner
  crash.string(w, 'FORFEIT_WIN winner must be string')
  crash.ok(w === 'X' || w === 'O', 'FORFEIT_WIN winner must be X or O')
  const seqVal = payload.seq
  crash.number(seqVal, 'FORFEIT_WIN seq must be a finite number')
  return {
    ...state,
    winner: w,
    status: 'completed',
    seq: seqVal,
  }
}

const commandRouter = createMessageRouter<State, Command, HandleResult>()
  .on(PlaceMark, (state, command, msg) => handlePlaceMark(state, command, msg))
  .on(Resign, (state, command, msg) => handleResign(state, command, msg))
  .on(JoinSession, (state, command, msg) =>
    handleJoinSession(state, command, msg),
  )
  .on(LeaveSession, (state, command) => handleLeaveSession(state, command))

const eventRouter = createMessageRouter<State, void, State>()
  .on(MarkPlaced, (state, _, msg) => reduceMarkPlaced(state, msg))
  .on(GameWon, (state, _, msg) => reduceGameWon(state, msg))
  .on(GameDrawn, (state, _, msg) => reduceGameDrawn(state, msg))
  .on(PlayerResigned, (state, _, msg) => reducePlayerResigned(state, msg))
  .on(SeatClaimed, (state, _, msg) => reduceSeatClaimed(state, msg))
  .on(SeatReleased, (state, _, msg) => reduceSeatReleased(state, msg))
  .on(ForfeitWin, (state, _, msg) => reduceForfeitWin(state, msg))

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
    }
  },

  handle(state: State, command: Command): HandleResult {
    crash.defined(state, 'state must be defined')
    crash.defined(command, 'command must be defined')
    crash.nonEmptyString(
      command.message.type,
      'command message type must be non-empty',
    )

    return commandRouter.dispatch(state, command, command.message, (_s, _c, msg) =>
      err(
        'UNKNOWN_COMMAND',
        `unknown command type: ${msg.type}`,
      ),
    )
  },

  reduce(state: State, event: Event): State {
    crash.defined(state, 'state must be defined')
    crash.defined(event, 'event must be defined')

    return eventRouter.dispatch(state, undefined, event, (s) => s)
  },
}
