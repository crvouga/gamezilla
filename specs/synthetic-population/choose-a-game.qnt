// A Synthetic User looks for a multiplayer opponent for a game the app offers.
// Offline, the Synthetic User keeps its chosen game until its connection returns.
module choose_a_game {
  /// The game chosen for the next activity.
  var chosenGame: str
  /// Whether the Synthetic User is looking for a multiplayer opponent.
  var seekingOpponent: bool

  /// Bookkeeping: the Synthetic User whose device has no connection.
  var _offline: Set[str]

  /// Bookkeeping: remember the chosen game when a device loses its connection.
  var _choiceBeforeOffline: str

  action init = all {
    chosenGame' = "",
    seekingOpponent' = false,
    _offline' = Set(),
    _choiceBeforeOffline' = "",
  }

  /// The Synthetic User starts its next activity by looking for a game.
  action startNextActivity = {
    nondet choice = Set("chess", "Connect Four", "Battleship", "Pong").oneOf()
    all {
      not(seekingOpponent),
      not(_offline.contains("Cedar")),
      chosenGame' = choice,
      seekingOpponent' = true,
      _offline' = _offline,
      _choiceBeforeOffline' = _choiceBeforeOffline,
    }
  }

  /// Bookkeeping: waiting leaves the chosen game alone.
  action _keepLooking = all {
    seekingOpponent,
    chosenGame' = chosenGame,
    seekingOpponent' = seekingOpponent,
    _offline' = _offline,
    _choiceBeforeOffline' = _choiceBeforeOffline,
  }

  /// Bookkeeping: the Synthetic User loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    chosenGame' = chosenGame,
    seekingOpponent' = seekingOpponent,
    _offline' = _offline.union(Set(who)),
    _choiceBeforeOffline' = chosenGame,
  }

  /// Bookkeeping: the Synthetic User's connection returns.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    chosenGame' = chosenGame,
    seekingOpponent' = seekingOpponent,
    _offline' = _offline.exclude(Set(who)),
    _choiceBeforeOffline' = _choiceBeforeOffline,
  }

  action step = {
    nondet who = Set("Cedar", "Bob").oneOf()
    any { startNextActivity, _keepLooking, _loseConnection(who), _comeBackOnline(who) }
  }

  /// Bookkeeping: an offline device keeps the game it already chose.
  val invOfflineKeepsChoice = _offline.contains("Cedar") implies (chosenGame == _choiceBeforeOffline)

  /// Only games offered by the app can be chosen.
  val invOnlyOfferedGames = Set("", "chess", "Connect Four", "Battleship", "Pong").contains(chosenGame)
  /// Looking for a multiplayer opponent always names a chosen game.
  val invLookingHasGame = seekingOpponent implies (chosenGame != "")
}
