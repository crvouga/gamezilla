// A timed match between White and Black, kept by a room.
//
// Either player can start the match, giving each side a bank of time; White
// moves first. The room's clock runs down the bank of the side to move. When
// the side to move moves, they keep what is left of their bank and the clock
// passes to the opponent. The moment the side to move's bank runs out, the
// room flags them and the opponent wins on time; nothing changes the match
// after that. A player cannot move out of turn, cannot start a match that is
// under way, and cannot end the match by claiming a flag before it has
// fallen. Both players' devices show the match as the room has it.
module match_clock {
  type Seat = str

  pure val SEATS: Set[Seat] = Set("white", "black")
  /// Banks a match can start with, in ms.
  pure val BANKS: Set[int] = Set(40, 80)
  /// How long a wait lasts, in ms.
  pure val WAITS: Set[int] = Set(10, 30, 60)

  /// "idle", "playing" or "flagged".
  var status: str
  /// The side to move.
  var turn: Seat
  /// What is left of White's bank at the start of their turn, in ms.
  var whiteMs: int
  /// What is left of Black's bank at the start of their turn, in ms.
  var blackMs: int
  /// The side that won on time, or "" while nobody has.
  var winner: str
  /// The match status each player's device shows.
  var seen: Seat -> str

  /// How long the side to move has been thinking, in ms.
  var elapsed: int

  pure def other(seat: Seat): Seat = if (seat == "white") "black" else "white"

  pure def bank(turn: Seat, whiteMs: int, blackMs: int): int =
    if (turn == "white") whiteMs else blackMs

  action update(
    newStatus: str,
    newTurn: Seat,
    newWhiteMs: int,
    newBlackMs: int,
    newWinner: str,
    newElapsed: int,
  ): bool = all {
    status' = newStatus,
    turn' = newTurn,
    whiteMs' = newWhiteMs,
    blackMs' = newBlackMs,
    winner' = newWinner,
    elapsed' = newElapsed,
    seen' = SEATS.mapBy(_ => newStatus),
  }

  action unchanged: bool = update(status, turn, whiteMs, blackMs, winner, elapsed)

  action init = update("idle", "white", 0, 0, "", 0)

  /// `seat` starts a match with the given banks; only an idle match starts.
  action start(seat: Seat, white: int, black: int): bool =
    if (status == "idle") update("playing", "white", white, black, "", 0)
    else unchanged

  /// `seat` moves; only the side to move, while playing, can.
  action move(seat: Seat): bool = {
    val left = bank(turn, whiteMs, blackMs) - elapsed
    if (status == "playing" and seat == turn)
      update(
        "playing",
        other(turn),
        if (turn == "white") left else whiteMs,
        if (turn == "black") left else blackMs,
        "",
        0,
      )
    else unchanged
  }

  /// `seat` claims `flagged`'s flag has fallen. While the match is playing
  /// the flag has not fallen yet (the room flags the moment it does), so the
  /// claim changes nothing.
  action claimFlag(seat: Seat, flagged: Seat): bool = unchanged

  /// `ms` pass on the room's clock.
  action wait(ms: int): bool =
    if (status == "playing" and elapsed + ms >= bank(turn, whiteMs, blackMs))
      update("flagged", turn, whiteMs, blackMs, other(turn), elapsed + ms)
    else if (status == "playing")
      update(status, turn, whiteMs, blackMs, winner, elapsed + ms)
    else unchanged

  action step = {
    nondet seat = SEATS.oneOf()
    nondet flagged = SEATS.oneOf()
    nondet white = BANKS.oneOf()
    nondet black = BANKS.oneOf()
    nondet ms = WAITS.oneOf()
    any {
      start(seat, white, black),
      move(seat),
      claimFlag(seat, flagged),
      wait(ms),
    }
  }

  /// There is a winner exactly when the match was flagged.
  val invWinnerOnlyWhenFlagged = (winner != "") == (status == "flagged")

  /// A match in play has time left on the clock.
  val invPlayingHasTime = status == "playing" implies elapsed < bank(turn, whiteMs, blackMs)

  /// The flagged side is the one that was to move, and the other side won.
  val invFlaggedSideLoses = status == "flagged" implies winner == other(turn)

  /// Banks never grow past what the match started with.
  val invBanksBounded = whiteMs >= 0 and blackMs >= 0 and whiteMs <= 80 and blackMs <= 80
}
