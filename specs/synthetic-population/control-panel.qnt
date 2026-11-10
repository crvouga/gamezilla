// Alice may control the Synthetic Population from the Synthetic Population
// panel. Each Synthetic User, Cedar and Maple, has a control panel there; Bob, a person,
// never has one. Alice pauses or resumes one Synthetic User, or every
// Synthetic User at once, and restarts one. A paused Synthetic User starts no
// new activity but finishes an ongoing game. Restarting keeps an ongoing game.
// With no connection, Alice cannot pause, resume or restart anyone; who is
// paused stays as it was until her connection returns.
module control_panel {
  /// The Synthetic Users that are paused.
  var paused: Set[str]
  /// The Synthetic Users playing an ongoing game.
  var playing: Set[str]
  /// Whose control panel Alice is offered.
  var controlPanelOffered: Set[str]
  /// Bookkeeping: who was playing when each paused Synthetic User was paused.
  var _playingWhenPaused: Set[str]
  /// Bookkeeping: the Synthetic User just restarted and whether it was playing.
  var _restarted: str
  var _restartedWhilePlaying: bool
  /// Bookkeeping: whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: who was paused when Alice went offline.
  var _pausedBeforeOffline: Set[str]

  pure val SYNTHETIC_USERS = Set("Cedar", "Maple")

  action init = all {
    paused' = Set(),
    playing' = Set(),
    controlPanelOffered' = SYNTHETIC_USERS,
    _playingWhenPaused' = Set(),
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = Set(),
    _pausedBeforeOffline' = Set(),
  }

  /// Alice opens the Synthetic Population panel and is offered each Synthetic User's control panel.
  action openPanel = all {
    not(_offline.contains("Alice")),
    paused' = paused,
    playing' = playing,
    controlPanelOffered' = SYNTHETIC_USERS,
    _playingWhenPaused' = _playingWhenPaused,
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Alice pauses one Synthetic User.
  action pause(who: str): bool = all {
    not(_offline.contains("Alice")),
    SYNTHETIC_USERS.contains(who),
    not(paused.contains(who)),
    paused' = paused.union(Set(who)),
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = if (playing.contains(who)) _playingWhenPaused.union(Set(who)) else _playingWhenPaused,
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Alice pauses every Synthetic User at once.
  action pauseAll = all {
    not(_offline.contains("Alice")),
    paused' = SYNTHETIC_USERS,
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused.union(playing.filter(s => not(paused.contains(s)))),
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Alice resumes one paused Synthetic User.
  action resume(who: str): bool = all {
    not(_offline.contains("Alice")),
    paused.contains(who),
    paused' = paused.exclude(Set(who)),
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused.exclude(Set(who)),
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Alice resumes every Synthetic User at once.
  action resumeAll = all {
    not(_offline.contains("Alice")),
    paused' = Set(),
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = Set(),
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Alice restarts one Synthetic User; it keeps any ongoing game.
  action restart(who: str): bool = all {
    not(_offline.contains("Alice")),
    SYNTHETIC_USERS.contains(who),
    paused' = paused,
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused,
    _restarted' = who,
    _restartedWhilePlaying' = playing.contains(who),
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// A Synthetic User that is not paused starts its next activity: a game.
  action startNextActivity(who: str): bool = all {
    SYNTHETIC_USERS.contains(who),
    not(paused.contains(who)),
    not(playing.contains(who)),
    paused' = paused,
    playing' = playing.union(Set(who)),
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused,
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Bookkeeping: an ongoing game reaches its multiplayer result.
  action _finishGame(who: str): bool = all {
    playing.contains(who),
    paused' = paused,
    playing' = playing.exclude(Set(who)),
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused.exclude(Set(who)),
    _restarted' = "",
    _restartedWhilePlaying' = false,
    _offline' = _offline,
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  /// Bookkeeping: a device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    paused' = paused,
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused,
    _restarted' = _restarted,
    _restartedWhilePlaying' = _restartedWhilePlaying,
    _offline' = _offline.union(Set(who)),
    _pausedBeforeOffline' = paused,
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    paused' = paused,
    playing' = playing,
    controlPanelOffered' = controlPanelOffered,
    _playingWhenPaused' = _playingWhenPaused,
    _restarted' = _restarted,
    _restartedWhilePlaying' = _restartedWhilePlaying,
    _offline' = _offline.exclude(Set(who)),
    _pausedBeforeOffline' = _pausedBeforeOffline,
  }

  action step = {
    nondet who = SYNTHETIC_USERS.oneOf()
    nondet device = Set("Alice").oneOf()
    any {
      openPanel,
      pause(who),
      pauseAll,
      resume(who),
      resumeAll,
      restart(who),
      startNextActivity(who),
      _finishGame(who),
      _loseConnection(device),
      _comeBackOnline(device),
    }
  }

  /// A paused Synthetic User starts no new activity; it only finishes the game it was playing.
  val invPausedStartsNothing = paused.forall(s => playing.contains(s) implies _playingWhenPaused.contains(s))
  /// Only Synthetic Users have a control panel; a person never does.
  val invNoControlPanelForPeople = controlPanelOffered == SYNTHETIC_USERS and not(controlPanelOffered.contains("Bob"))
  /// Restarting a Synthetic User keeps its ongoing game.
  val invRestartKeepsGame = (_restarted != "" and _restartedWhilePlaying) implies playing.contains(_restarted)
  /// Bookkeeping: while Alice is offline, who is paused stays as it was.
  val invOfflineKeepsPaused = _offline.contains("Alice") implies (paused == _pausedBeforeOffline)
}
