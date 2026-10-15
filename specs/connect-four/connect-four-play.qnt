// Red and Yellow drop discs into seven columns with six places each.
// A winning alignment ends play before a full board becomes a draw.
// When both players have no connection, they keep their last board and cannot
// drop a disc. Returning online restores that same board and turn.
module connect_four_play {
  var board: int -> int
  var _heights: int -> int
  var turn: int
  var result: int
  var drops: List[int]
  var online: bool
  var _atDisconnect: (int -> int, List[int], int, int)
  pure val _COLUMNS = 0.to(6)
  pure val _CELLS = 0.to(41)
  pure def _won(b: int -> int, p: int): bool = or {
    and { b.get(0) == p, b.get(1) == p, b.get(2) == p, b.get(3) == p },
    and { b.get(0) == p, b.get(7) == p, b.get(14) == p, b.get(21) == p },
    and { b.get(0) == p, b.get(8) == p, b.get(16) == p, b.get(24) == p },
    and { b.get(1) == p, b.get(2) == p, b.get(3) == p, b.get(4) == p },
    and { b.get(1) == p, b.get(8) == p, b.get(15) == p, b.get(22) == p },
    and { b.get(1) == p, b.get(9) == p, b.get(17) == p, b.get(25) == p },
    and { b.get(2) == p, b.get(3) == p, b.get(4) == p, b.get(5) == p },
    and { b.get(2) == p, b.get(9) == p, b.get(16) == p, b.get(23) == p },
    and { b.get(2) == p, b.get(10) == p, b.get(18) == p, b.get(26) == p },
    and { b.get(3) == p, b.get(4) == p, b.get(5) == p, b.get(6) == p },
    and { b.get(3) == p, b.get(10) == p, b.get(17) == p, b.get(24) == p },
    and { b.get(3) == p, b.get(11) == p, b.get(19) == p, b.get(27) == p },
    and { b.get(4) == p, b.get(11) == p, b.get(18) == p, b.get(25) == p },
    and { b.get(5) == p, b.get(12) == p, b.get(19) == p, b.get(26) == p },
    and { b.get(6) == p, b.get(13) == p, b.get(20) == p, b.get(27) == p },
    and { b.get(7) == p, b.get(8) == p, b.get(9) == p, b.get(10) == p },
    and { b.get(7) == p, b.get(14) == p, b.get(21) == p, b.get(28) == p },
    and { b.get(7) == p, b.get(15) == p, b.get(23) == p, b.get(31) == p },
    and { b.get(8) == p, b.get(9) == p, b.get(10) == p, b.get(11) == p },
    and { b.get(8) == p, b.get(15) == p, b.get(22) == p, b.get(29) == p },
    and { b.get(8) == p, b.get(16) == p, b.get(24) == p, b.get(32) == p },
    and { b.get(9) == p, b.get(10) == p, b.get(11) == p, b.get(12) == p },
    and { b.get(9) == p, b.get(16) == p, b.get(23) == p, b.get(30) == p },
    and { b.get(9) == p, b.get(17) == p, b.get(25) == p, b.get(33) == p },
    and { b.get(10) == p, b.get(11) == p, b.get(12) == p, b.get(13) == p },
    and { b.get(10) == p, b.get(17) == p, b.get(24) == p, b.get(31) == p },
    and { b.get(10) == p, b.get(18) == p, b.get(26) == p, b.get(34) == p },
    and { b.get(11) == p, b.get(18) == p, b.get(25) == p, b.get(32) == p },
    and { b.get(12) == p, b.get(19) == p, b.get(26) == p, b.get(33) == p },
    and { b.get(13) == p, b.get(20) == p, b.get(27) == p, b.get(34) == p },
    and { b.get(14) == p, b.get(15) == p, b.get(16) == p, b.get(17) == p },
    and { b.get(14) == p, b.get(21) == p, b.get(28) == p, b.get(35) == p },
    and { b.get(14) == p, b.get(22) == p, b.get(30) == p, b.get(38) == p },
    and { b.get(15) == p, b.get(16) == p, b.get(17) == p, b.get(18) == p },
    and { b.get(15) == p, b.get(22) == p, b.get(29) == p, b.get(36) == p },
    and { b.get(15) == p, b.get(23) == p, b.get(31) == p, b.get(39) == p },
    and { b.get(16) == p, b.get(17) == p, b.get(18) == p, b.get(19) == p },
    and { b.get(16) == p, b.get(23) == p, b.get(30) == p, b.get(37) == p },
    and { b.get(16) == p, b.get(24) == p, b.get(32) == p, b.get(40) == p },
    and { b.get(17) == p, b.get(18) == p, b.get(19) == p, b.get(20) == p },
    and { b.get(17) == p, b.get(24) == p, b.get(31) == p, b.get(38) == p },
    and { b.get(17) == p, b.get(25) == p, b.get(33) == p, b.get(41) == p },
    and { b.get(18) == p, b.get(25) == p, b.get(32) == p, b.get(39) == p },
    and { b.get(19) == p, b.get(26) == p, b.get(33) == p, b.get(40) == p },
    and { b.get(20) == p, b.get(27) == p, b.get(34) == p, b.get(41) == p },
    and { b.get(21) == p, b.get(22) == p, b.get(23) == p, b.get(24) == p },
    and { b.get(21) == p, b.get(15) == p, b.get(9) == p, b.get(3) == p },
    and { b.get(22) == p, b.get(23) == p, b.get(24) == p, b.get(25) == p },
    and { b.get(22) == p, b.get(16) == p, b.get(10) == p, b.get(4) == p },
    and { b.get(23) == p, b.get(24) == p, b.get(25) == p, b.get(26) == p },
    and { b.get(23) == p, b.get(17) == p, b.get(11) == p, b.get(5) == p },
    and { b.get(24) == p, b.get(25) == p, b.get(26) == p, b.get(27) == p },
    and { b.get(24) == p, b.get(18) == p, b.get(12) == p, b.get(6) == p },
    and { b.get(28) == p, b.get(29) == p, b.get(30) == p, b.get(31) == p },
    and { b.get(28) == p, b.get(22) == p, b.get(16) == p, b.get(10) == p },
    and { b.get(29) == p, b.get(30) == p, b.get(31) == p, b.get(32) == p },
    and { b.get(29) == p, b.get(23) == p, b.get(17) == p, b.get(11) == p },
    and { b.get(30) == p, b.get(31) == p, b.get(32) == p, b.get(33) == p },
    and { b.get(30) == p, b.get(24) == p, b.get(18) == p, b.get(12) == p },
    and { b.get(31) == p, b.get(32) == p, b.get(33) == p, b.get(34) == p },
    and { b.get(31) == p, b.get(25) == p, b.get(19) == p, b.get(13) == p },
    and { b.get(35) == p, b.get(36) == p, b.get(37) == p, b.get(38) == p },
    and { b.get(35) == p, b.get(29) == p, b.get(23) == p, b.get(17) == p },
    and { b.get(36) == p, b.get(37) == p, b.get(38) == p, b.get(39) == p },
    and { b.get(36) == p, b.get(30) == p, b.get(24) == p, b.get(18) == p },
    and { b.get(37) == p, b.get(38) == p, b.get(39) == p, b.get(40) == p },
    and { b.get(37) == p, b.get(31) == p, b.get(25) == p, b.get(19) == p },
    and { b.get(38) == p, b.get(39) == p, b.get(40) == p, b.get(41) == p },
    and { b.get(38) == p, b.get(32) == p, b.get(26) == p, b.get(20) == p },
  }
  action init = all {
    board' = _CELLS.mapBy(_ => 0), _heights' = _COLUMNS.mapBy(_ => 0),
    turn' = 1, result' = 0, drops' = [], online' = true, _atDisconnect' = (_CELLS.mapBy(_ => 0), [], 1, 0),
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and _COLUMNS.contains(column) and _heights.get(column) < 6) {
      val b = board.set(_heights.get(column) * 7 + column, turn)
      val played = drops.append(column)
      all {
        board' = b, _heights' = _heights.set(column, _heights.get(column) + 1),
        drops' = played, turn' = 3 - turn, online' = online, _atDisconnect' = _atDisconnect,
        result' = if (_won(b, turn)) turn else if (played.length() == 42) 3 else 0,
      }
    } else all { board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, online' = online, _atDisconnect' = _atDisconnect }
  /// Both players lose their connection and keep their last board.
  action loseConnection = all {
    online, online' = false, _atDisconnect' = (board, drops, turn, result), board' = board, _heights' = _heights,
    turn' = turn, result' = result, drops' = drops,
  }
  /// Both players return to the same board and turn.
  action connectionReturns = all {
    not(online), online' = true, _atDisconnect' = _atDisconnect, board' = board, _heights' = _heights,
    turn' = turn, result' = result, drops' = drops,
  }
  action step = any {
    { nondet column = (-1).to(7).oneOf(); drop(column) },
    loseConnection, connectionReturns,
  }
  /// Each player takes alternate turns, beginning with Red.
  val invTurn = turn == (if (drops.length() % 2 == 0) 1 else 2)
  /// The board and turn stay unchanged while neither player has a connection.
  val invOfflineBoard = not(online) implies ((board, drops, turn, result) == _atDisconnect)
  /// Bookkeeping: a column holds at most six discs.
  val invCapacity = _COLUMNS.forall(c => _heights.get(c) >= 0 and _heights.get(c) <= 6)
  /// Bookkeeping: discs cannot float above an empty place.
  val invGravity = _CELLS.forall(i => (board.get(i) != 0) == (i / 7 < _heights.get(i % 7)))
  /// Bookkeeping: every accepted drop adds one disc.
  val invConservation = _COLUMNS.fold(0, (a, c) => a + _heights.get(c)) == drops.length()
  /// Bookkeeping: only Red, Yellow, empty and draw have meanings here.
  val invOwnership = _CELLS.forall(i => Set(0, 1, 2).contains(board.get(i)))
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (drops.length() == 42 and not(_won(board, 1)) and not(_won(board, 2)))
}
