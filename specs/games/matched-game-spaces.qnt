// Two hosts play one matched game of the game from their own spaces. A guest
// may join either space to watch, leave it, and return to the accepted board.
// An offline guest keeps the last accepted board and cannot move. Returning
// online shows the current accepted board and result.
// The moves are each side's first move of the game's known victory. After
// both first moves, either host may resign. Before both first moves,
// resignation changes nothing.
module matched_game_spaces {
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val HOSTS = Set("alice", "bob")
  /// Accepted moves shown to each person; nobody sees a board outside a space.
  var shownMoves: str -> int
  /// The winner each person sees, or nobody while play continues or is hidden.
  var shownWinner: str -> str
  /// Whether each person can make a move on the board.
  var canMove: str -> bool
  var _guestSpace: str
  var _moves: int
  var _winner: str
  var _online: bool
  def _inside(person: str): bool = HOSTS.contains(person) or _guestSpace != "outside"
  def _turn: str = if (_moves % 2 == 0) "alice" else "bob"
  action _show(guestSpace, moves, winner, online) = all {
    _guestSpace' = guestSpace, _moves' = moves, _winner' = winner, _online' = online,
    shownMoves' = PEOPLE.mapBy(p => if (p == "carol" and not(online)) shownMoves.get(p) else if (HOSTS.contains(p) or guestSpace != "outside") moves else -1),
    shownWinner' = PEOPLE.mapBy(p => if (p == "carol" and not(online)) shownWinner.get(p) else if (HOSTS.contains(p) or guestSpace != "outside") winner else "nobody"),
    canMove' = PEOPLE.mapBy(p => HOSTS.contains(p) and winner == "nobody" and p == (if (moves % 2 == 0) "alice" else "bob")),
  }
  action init = all {
    _online' = true, _guestSpace' = "outside", _moves' = 0, _winner' = "nobody",
    shownMoves' = PEOPLE.mapBy(p => if (HOSTS.contains(p)) 0 else -1),
    shownWinner' = PEOPLE.mapBy(_ => "nobody"),
    canMove' = PEOPLE.mapBy(p => p == "alice"),
  }
  /// Joining either host's space shows its matched game's current board.
  action joinSpace(host: str): bool = all {
    _online, _guestSpace == "outside", HOSTS.contains(host),
    _show(host, _moves, _winner, _online),
  }
  /// A guest who leaves no longer watches the board.
  action leaveSpace = all {
    _online, _guestSpace != "outside", _show("outside", _moves, _winner, _online),
  }
  /// Opening finding an opponent keeps the same accepted matched game.
  action openFindingAnOpponent = _show(_guestSpace, _moves, _winner, _online)
  /// Only a paired person on their turn may move; watchers cannot move.
  action playMove(person: str): bool = {
    val accepted = HOSTS.contains(person) and _winner == "nobody" and person == _turn
    all {
      not(accepted) or _moves < 2,
      _show(_guestSpace, if (accepted) _moves + 1 else _moves, _winner, _online),
    }
  }
  /// After both first moves, resignation gives the other paired person the lasting win.
  action resignGame(person: str): bool = {
    val winner = if (HOSTS.contains(person) and _winner == "nobody" and _moves >= 2)
      (if (person == "alice") "bob" else "alice") else _winner
    _show(_guestSpace, _moves, winner, _online)
  }
  /// Losing the connection keeps the guest's last accepted board.
  action loseConnection = all {
    _online, _guestSpace != "outside",
    _show(_guestSpace, _moves, _winner, false),
  }
  /// Returning online shows the accepted board and result.
  action comeBackOnline = all {
    not(_online), _show(_guestSpace, _moves, _winner, true),
  }
  action step = {
    nondet host = HOSTS.oneOf()
    nondet person = PEOPLE.oneOf()
    any { joinSpace(host), leaveSpace, openFindingAnOpponent, playMove(person), resignGame(person), loseConnection, comeBackOnline }
  }
  /// Hosts and guests in either space see the same accepted board and result.
  val invSharedBoard = PEOPLE.forall(p => (_inside(p) and (p != "carol" or _online)) implies and {
    shownMoves.get(p) == _moves, shownWinner.get(p) == _winner,
  })
  /// Leaving the space removes the guest's board and result.
  val invOutsideCannotWatch = _guestSpace == "outside" implies and {
    shownMoves.get("carol") == -1, shownWinner.get("carol") == "nobody",
  }
  /// Guests never gain a side, and the paired people cannot move after a result.
  val invMatchedPeopleOnly = PEOPLE.forall(p => canMove.get(p) implies and {
    HOSTS.contains(p), _winner == "nobody", p == _turn,
  })
}
