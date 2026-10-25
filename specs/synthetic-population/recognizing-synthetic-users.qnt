// Opening a game keeps a Synthetic User recognizable as automated, while a
// person never appears automated. A lost connection keeps that identification.
module recognizing_synthetic_users {
  /// The Synthetic User's username identifies it as automated.
  var syntheticIdentified: bool
  /// The person's username identifies them as automated.
  var personIdentified: bool
  /// Whether Bob's device has its connection available.
  var connectionAvailable: bool
  /// Bookkeeping: the person whose device has no connection.
  var _offline: Set[str]

  action init = {
    nondet chosenGame = Set("chess", "Connect Four", "Pong").oneOf()
    all {
      syntheticIdentified' = true,
      personIdentified' = false,
      connectionAvailable' = true,
      _offline' = Set(),
    }
  }

  /// Bob opens the game with the Synthetic User as his multiplayer opponent.
  action openMultiplayer = all {
    syntheticIdentified' = syntheticIdentified,
    personIdentified' = personIdentified,
    connectionAvailable' = not(_offline.contains("Bob")),
    _offline' = _offline,
  }

  /// Bookkeeping: Bob's device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    syntheticIdentified' = syntheticIdentified,
    personIdentified' = personIdentified,
    connectionAvailable' = not(_offline.union(Set(who)).contains("Bob")),
    _offline' = _offline.union(Set(who)),
  }

  /// Bookkeeping: Bob's connection returns.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    syntheticIdentified' = syntheticIdentified,
    personIdentified' = personIdentified,
    connectionAvailable' = not(_offline.exclude(Set(who)).contains("Bob")),
    _offline' = _offline.exclude(Set(who)),
  }

  action step = {
    nondet who = Set("Bob", "Cedar").oneOf()
    any { openMultiplayer, _loseConnection(who), _comeBackOnline(who) }
  }

  /// Opening a game never hides that the opponent is a Synthetic User.
  val invSyntheticRecognition = syntheticIdentified
  /// Opening a game never identifies a person as automated.
  val invPersonRecognition = not(personIdentified)
  /// Identification stays correct while Bob has no connection.
  val invOfflineKeepsIdentification = _offline.contains("Bob") implies (syntheticIdentified and not(personIdentified) and not(connectionAvailable))
}
