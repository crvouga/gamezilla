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
  pure val _DIRECTIONS = Set((1, 0), (0, 1), (1, 1), (1, -1))
  pure def _line(b: int -> int, c: int, r: int, dc: int, dr: int, p: int): bool =
    0.to(3).forall(n => {
      val x = c + n * dc
      val y = r + n * dr
      x >= 0 and x < 7 and y >= 0 and y < 6 and b.get(y * 7 + x) == p
    })
  pure def _won(b: int -> int, p: int): bool =
    _CELLS.exists(i => _DIRECTIONS.exists(d => _line(b, i % 7, i / 7, d._1, d._2, p)))
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
