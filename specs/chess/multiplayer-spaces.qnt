// Two hosts play one multiplayer game from their own spaces. A guest may
// join either space to watch, leave it, and return to the accepted board.
// An offline guest keeps the last accepted board and cannot move. Returning
// online shows the current accepted board and result.
// The short opening is e2 to e4 followed by e7 to e5. Either host may resign.
module multiplayer_spaces {
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val HOSTS = Set("alice", "bob")
  /// Accepted moves shown to each person; nobody sees a board outside a space.
  var shownMoves: str -> int
  /// The winner each person sees, or nobody while play continues or is hidden.
  var shownWinner: str -> str
  /// Whether each person can move a piece on the multiplayer board.
  var canMove: str -> bool
  var _guestSpace: str
  var _moves: int
  var _winner: str
  var _offline: bool
  def _inside(person): bool = HOSTS.contains(person) or _guestSpace != "outside"
  def _turn: str = if (_moves % 2 == 0) "alice" else "bob"
  action _show(guestSpace, moves, winner, offline) = all {
    _guestSpace' = guestSpace, _moves' = moves, _winner' = winner, _offline' = offline,
    shownMoves' = PEOPLE.mapBy(p => if (p == "carol" and offline) shownMoves.get(p) else if (HOSTS.contains(p) or guestSpace != "outside") moves else -1),
    shownWinner' = PEOPLE.mapBy(p => if (p == "carol" and offline) shownWinner.get(p) else if (HOSTS.contains(p) or guestSpace != "outside") winner else "nobody"),
    canMove' = PEOPLE.mapBy(p => HOSTS.contains(p) and winner == "nobody" and p == (if (moves % 2 == 0) "alice" else "bob")),
  }
  action init = _show("outside", 0, "nobody", false)
  /// Joining either host's space shows its current multiplayer board.
  action joinSpace(host: str) = all {
    not(_offline), _guestSpace == "outside", HOSTS.contains(host),
    _show(host, _moves, _winner, _offline),
  }
  /// A guest who leaves no longer watches the multiplayer board.
  action leaveSpace = all {
    not(_offline), _guestSpace != "outside", _show("outside", _moves, _winner, _offline),
  }
  /// Opening multiplayer chess keeps the same accepted game.
  action openMultiplayer = _show(_guestSpace, _moves, _winner, _offline)
  /// Only a matched person on their turn may move; watchers cannot move.
  action playMove(person: str) = {
    val accepted = HOSTS.contains(person) and _winner == "nobody" and person == _turn
    all {
      not(accepted) or _moves < 2,
      _show(_guestSpace, if (accepted) _moves + 1 else _moves, _winner, _offline),
    }
  }
  /// Resignation gives the other matched person the lasting win.
  action resignPlay(person: str) = {
    val winner = if (HOSTS.contains(person) and _winner == "nobody")
      (if (person == "alice") "bob" else "alice") else _winner
    _show(_guestSpace, _moves, winner, _offline)
  }
  /// Losing the connection keeps the guest's last accepted board.
  action loseConnection = all {
    not(_offline), _guestSpace != "outside",
    _show(_guestSpace, _moves, _winner, true),
  }
  /// Returning online shows the accepted board and result.
  action comeBackOnline = all {
    _offline, _show(_guestSpace, _moves, _winner, false),
  }
  action step = {
    nondet host = HOSTS.oneOf()
    nondet person = PEOPLE.oneOf()
    any { joinSpace(host), leaveSpace, openMultiplayer, playMove(person), resignPlay(person), loseConnection, comeBackOnline }
  }
  /// Hosts and guests in either space see the same accepted board and result.
  val invSharedBoard = PEOPLE.forall(p => (_inside(p) and (p != "carol" or not(_offline))) implies and {
    shownMoves.get(p) == _moves, shownWinner.get(p) == _winner,
  })
  /// Leaving the space removes the guest's board and result.
  val invOutsideCannotWatch = _guestSpace == "outside" implies and {
    shownMoves.get("carol") == -1, shownWinner.get("carol") == "nobody",
  }
  /// Guests never gain a side, and matched people cannot move after a result.
  val invMatchedPeopleOnly = PEOPLE.forall(p => canMove.get(p) implies and {
    HOSTS.contains(p), _winner == "nobody", p == _turn,
  })
}
