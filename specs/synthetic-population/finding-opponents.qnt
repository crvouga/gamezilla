// People and Synthetic Users look for a multiplayer opponent for the same
// game. A person looking is matched with another person looking first; when
// no person is looking, an available Synthetic User becomes their multiplayer
// opponent within 30 seconds (each action here includes that wait). With no
// person looking, Synthetic Users looking are matched with each other. A
// paused Synthetic User is not available; when every Synthetic User is paused
// or playing, a person keeps looking.
// With no connection, Bob cannot start looking; anyone already looking stays
// as they were until his connection returns.
module finding_opponents {
  /// How many people are looking for a multiplayer opponent.
  var peopleLooking: int
  /// How many people are playing a game against a multiplayer opponent.
  var peoplePlaying: int
  /// How many Synthetic Users are available and not yet looking or playing.
  var syntheticAvailable: int
  /// How many Synthetic Users are looking for a multiplayer opponent.
  var syntheticLooking: int
  /// How many Synthetic Users are playing a game.
  var syntheticPlaying: int
  /// How many Synthetic Users are paused and not playing.
  var syntheticPaused: int
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: how many people were looking when Bob went offline.
  var _peopleLookingBeforeOffline: int

  action init = {
    nondet available = 0.to(3).oneOf()
    all {
      peopleLooking' = 0,
      peoplePlaying' = 0,
      syntheticAvailable' = available,
      syntheticLooking' = 0,
      syntheticPlaying' = 0,
      syntheticPaused' = 0,
      _offline' = Set(),
      _peopleLookingBeforeOffline' = 0,
    }
  }

  /// A person looks for a multiplayer opponent: another person looking first, then a Synthetic User.
  action lookForOpponent = all {
    not(_offline.contains("Bob")),
    if (peopleLooking > 0) all {
      peopleLooking' = peopleLooking - 1,
      peoplePlaying' = peoplePlaying + 2,
      syntheticAvailable' = syntheticAvailable,
      syntheticLooking' = syntheticLooking,
      syntheticPlaying' = syntheticPlaying,
    } else if (syntheticLooking > 0) all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying + 1,
      syntheticAvailable' = syntheticAvailable,
      syntheticLooking' = syntheticLooking - 1,
      syntheticPlaying' = syntheticPlaying + 1,
    } else if (syntheticAvailable > 0) all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying + 1,
      syntheticAvailable' = syntheticAvailable - 1,
      syntheticLooking' = syntheticLooking,
      syntheticPlaying' = syntheticPlaying + 1,
    } else all {
      peopleLooking' = peopleLooking + 1,
      peoplePlaying' = peoplePlaying,
      syntheticAvailable' = syntheticAvailable,
      syntheticLooking' = syntheticLooking,
      syntheticPlaying' = syntheticPlaying,
    },
    syntheticPaused' = syntheticPaused,
    _offline' = _offline,
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  /// An available Synthetic User starts its next activity: a person looking first, then another Synthetic User.
  action startNextActivity = all {
    syntheticAvailable > 0,
    syntheticAvailable' = syntheticAvailable - 1,
    if (peopleLooking > 0) all {
      peopleLooking' = peopleLooking - 1,
      peoplePlaying' = peoplePlaying + 1,
      syntheticLooking' = syntheticLooking,
      syntheticPlaying' = syntheticPlaying + 1,
    } else if (syntheticLooking > 0) all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying,
      syntheticLooking' = syntheticLooking - 1,
      syntheticPlaying' = syntheticPlaying + 2,
    } else all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying,
      syntheticLooking' = syntheticLooking + 1,
      syntheticPlaying' = syntheticPlaying,
    },
    syntheticPaused' = syntheticPaused,
    _offline' = _offline,
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  /// An available Synthetic User is paused.
  action pause = all {
    syntheticAvailable > 0,
    peopleLooking' = peopleLooking,
    peoplePlaying' = peoplePlaying,
    syntheticAvailable' = syntheticAvailable - 1,
    syntheticLooking' = syntheticLooking,
    syntheticPlaying' = syntheticPlaying,
    syntheticPaused' = syntheticPaused + 1,
    _offline' = _offline,
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  /// A paused Synthetic User is resumed and, if a person is looking, becomes their multiplayer opponent.
  action resume = all {
    syntheticPaused > 0,
    syntheticPaused' = syntheticPaused - 1,
    if (peopleLooking > 0) all {
      peopleLooking' = peopleLooking - 1,
      peoplePlaying' = peoplePlaying + 1,
      syntheticAvailable' = syntheticAvailable,
      syntheticPlaying' = syntheticPlaying + 1,
    } else all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying,
      syntheticAvailable' = syntheticAvailable + 1,
      syntheticPlaying' = syntheticPlaying,
    },
    syntheticLooking' = syntheticLooking,
    _offline' = _offline,
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  /// Bookkeeping: a game between a person and a Synthetic User reaches its multiplayer result;
  /// the Synthetic User, available again, becomes the multiplayer opponent of a person looking.
  action _finishGame = all {
    peoplePlaying > 0,
    syntheticPlaying > 0,
    if (peopleLooking > 0) all {
      peopleLooking' = peopleLooking - 1,
      peoplePlaying' = peoplePlaying,
      syntheticAvailable' = syntheticAvailable,
      syntheticPlaying' = syntheticPlaying,
    } else all {
      peopleLooking' = peopleLooking,
      peoplePlaying' = peoplePlaying - 1,
      syntheticAvailable' = syntheticAvailable + 1,
      syntheticPlaying' = syntheticPlaying - 1,
    },
    syntheticLooking' = syntheticLooking,
    syntheticPaused' = syntheticPaused,
    _offline' = _offline,
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  /// Bookkeeping: a device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    peopleLooking' = peopleLooking,
    peoplePlaying' = peoplePlaying,
    syntheticAvailable' = syntheticAvailable,
    syntheticLooking' = syntheticLooking,
    syntheticPlaying' = syntheticPlaying,
    syntheticPaused' = syntheticPaused,
    _offline' = _offline.union(Set(who)),
    _peopleLookingBeforeOffline' = peopleLooking,
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    peopleLooking' = peopleLooking,
    peoplePlaying' = peoplePlaying,
    syntheticAvailable' = syntheticAvailable,
    syntheticLooking' = syntheticLooking,
    syntheticPlaying' = syntheticPlaying,
    syntheticPaused' = syntheticPaused,
    _offline' = _offline.exclude(Set(who)),
    _peopleLookingBeforeOffline' = _peopleLookingBeforeOffline,
  }

  action step = {
    nondet who = Set("Bob").oneOf()
    any {
      lookForOpponent,
      startNextActivity,
      pause,
      resume,
      _finishGame,
      _loseConnection(who),
      _comeBackOnline(who),
    }
  }

  /// A person never keeps looking while a Synthetic User is available or looking.
  val invNobodyWaitsBesideAvailable = (peopleLooking > 0) implies (syntheticAvailable == 0 and syntheticLooking == 0)
  /// People looking for the same game are matched with each other before any Synthetic User.
  val invPeopleMatchedFirst = peopleLooking <= 1
  /// With no person looking, Synthetic Users looking are matched with each other.
  val invSyntheticUsersMatchedTogether = syntheticLooking <= 1
  /// A person and a Synthetic User are never both left looking.
  val invNeverBothLooking = not(peopleLooking > 0 and syntheticLooking > 0)
  /// Bookkeeping: no count ever drops below zero.
  val invCountsNeverNegative = syntheticPaused >= 0 and syntheticPlaying >= 0 and syntheticAvailable >= 0 and peoplePlaying >= 0
  /// Bookkeeping: Bob cannot start looking while offline.
  val invOfflineCannotStartLooking = _offline.contains("Bob") implies (peopleLooking <= _peopleLookingBeforeOffline)
}
