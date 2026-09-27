// A timed match between White and Black, kept by a room.
//
// Either of them can start the match, giving White and Black each a bank of
// time; White moves first. The match clock runs down the bank of the side to
// move. When the side to move moves, they keep what is left of their bank and
// the side to move becomes their opponent. The moment the side to move's bank
// runs out, the room flags them and their opponent wins on time; nothing
// changes the match after that. Nobody can move out of turn, start a match
// that is under way, or end the match by claiming a flag before it has
// fallen. White's and Black's devices both show the match as the room has it.
module match_clock {
  type Side = str

  pure val SIDES: Set[Side] = Set("white", "black")
  /// Banks a match can start with, in ms.
  pure val BANKS: Set[int] = Set(40, 80)
  /// How long the match clock runs at a time, in ms.
  pure val WAITS: Set[int] = Set(10, 30, 60)

  /// "idle", "playing" or "flagged".
  var matchStatus: str
  /// The side to move.
  var sideToMove: Side
  /// What is left of White's bank at the start of their turn, in ms.
  var whiteBank: int
  /// What is left of Black's bank at the start of their turn, in ms.
  var blackBank: int
  /// The side that won on time, or "" while nobody has.
  var winner: str
  /// The match status White's and Black's devices each show.
  var matchShown: Side -> str

  /// How long the side to move has been thinking, in ms.
  var thinkingTime: int

  pure def opponent(side: Side): Side = if (side == "white") "black" else "white"

  pure def bank(side: Side, whiteBank: int, blackBank: int): int =
    if (side == "white") whiteBank else blackBank

  action _update(
    newStatus: str,
    newSideToMove: Side,
    newWhiteBank: int,
    newBlackBank: int,
    newWinner: str,
    newThinkingTime: int,
  ): bool = all {
    matchStatus' = newStatus,
    sideToMove' = newSideToMove,
    whiteBank' = newWhiteBank,
    blackBank' = newBlackBank,
    winner' = newWinner,
    thinkingTime' = newThinkingTime,
    matchShown' = SIDES.mapBy(_ => newStatus),
  }

  action _unchanged: bool =
    _update(matchStatus, sideToMove, whiteBank, blackBank, winner, thinkingTime)

  action init = _update("idle", "white", 0, 0, "", 0)

  /// `seat` starts a match with the given banks; only an idle match starts.
  action startMatch(seat: Side, white: int, black: int): bool =
    if (matchStatus == "idle") _update("playing", "white", white, black, "", 0)
    else _unchanged

  /// `seat` moves; only the side to move, while playing, can.
  action move(seat: Side): bool = {
    val left = bank(sideToMove, whiteBank, blackBank) - thinkingTime
    if (matchStatus == "playing" and seat == sideToMove)
      _update(
        "playing",
        opponent(sideToMove),
        if (sideToMove == "white") left else whiteBank,
        if (sideToMove == "black") left else blackBank,
        "",
        0,
      )
    else _unchanged
  }

  /// `seat` claims `flagged`'s flag has fallen. While the match is playing
  /// the flag has not fallen yet (the room flags the moment it does), so the
  /// claim changes nothing.
  action claimFlag(seat: Side, flagged: Side): bool = _unchanged

  /// The match clock runs for `ms`.
  action clockRuns(ms: int): bool =
    if (matchStatus == "playing" and thinkingTime + ms >= bank(sideToMove, whiteBank, blackBank))
      _update("flagged", sideToMove, whiteBank, blackBank, opponent(sideToMove), thinkingTime + ms)
    else if (matchStatus == "playing")
      _update(matchStatus, sideToMove, whiteBank, blackBank, winner, thinkingTime + ms)
    else _unchanged

  action step = {
    nondet seat = SIDES.oneOf()
    nondet flagged = SIDES.oneOf()
    nondet white = BANKS.oneOf()
    nondet black = BANKS.oneOf()
    nondet ms = WAITS.oneOf()
    any {
      startMatch(seat, white, black),
      move(seat),
      claimFlag(seat, flagged),
      clockRuns(ms),
    }
  }

  /// There is a winner exactly when the match was flagged.
  val invWinnerOnlyWhenFlagged = (winner != "") == (matchStatus == "flagged")

  /// A match in play has time left on the clock.
  val invPlayingHasTime =
    matchStatus == "playing" implies thinkingTime < bank(sideToMove, whiteBank, blackBank)

  /// The flagged side is the one that was to move, and their opponent won.
  val invFlaggedSideLoses = matchStatus == "flagged" implies winner == opponent(sideToMove)

  /// Banks never grow past what the match started with.
  val invBanksBounded =
    whiteBank >= 0 and blackBank >= 0 and whiteBank <= 80 and blackBank <= 80
}
