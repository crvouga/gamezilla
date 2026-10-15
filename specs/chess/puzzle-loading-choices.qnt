// The team confirms stopping an addition and can cancel or try a failed stop again.
// An addition may finish before the confirmation arrives; its result is kept.
// Offline the last result remains visible, and confirming a stop is unavailable.
module puzzle_loading_choices {
  /// The stage of the team's choice to stop adding puzzles.
  var stoppingPuzzles: str
  /// The addition result the team last saw.
  var addingPuzzlesStatus: str
  /// Whether the team's device has a connection.
  var online: bool
  var _actualChoice: str
  var _actualStatus: str
  var _statusWhenOffline: str

  action init = {
    nondet _status = Set("ready", "adding", "finished", "failed", "stopped").oneOf()
    all { stoppingPuzzles' = "idle", addingPuzzlesStatus' = _status, online' = true,
      _actualChoice' = "idle", _actualStatus' = _status, _statusWhenOffline' = _status }
  }

  action _keepAddition = all {
    addingPuzzlesStatus' = addingPuzzlesStatus, _actualStatus' = _actualStatus,
    online' = online, _statusWhenOffline' = _statusWhenOffline,
  }

  /// Asking is available only for an ongoing addition with a connection.
  action askToStopAddingPuzzles = all {
    online, _actualStatus == "adding", stoppingPuzzles == "idle",
    stoppingPuzzles' = "confirming", _actualChoice' = "confirming", _keepAddition,
  }

  /// Cancelling or dismissing the choice keeps the addition's current result.
  action cancelStoppingPuzzles = all {
    Set("confirming", "failed").contains(stoppingPuzzles), stoppingPuzzles' = "idle", _actualChoice' = "idle", _keepAddition,
  }

  /// Confirmation starts stopping, or acknowledges the result when adding already finished.
  action confirmStoppingPuzzles = all {
    online, Set("confirming", "failed").contains(stoppingPuzzles),
    stoppingPuzzles' = if (_actualStatus == "adding") "stopping" else "succeeded",
    _actualChoice' = if (_actualStatus == "adding") "stopping" else "succeeded", _keepAddition,
  }

  /// A successful stop keeps a finished result; an offline person sees it on returning online.
  action finishStoppingPuzzles = {
    val _result = if (_actualStatus == "adding") "stopped" else _actualStatus
    all {
      _actualChoice == "stopping", _actualChoice' = "succeeded",
      stoppingPuzzles' = if (online) "succeeded" else stoppingPuzzles, _actualStatus' = _result,
      addingPuzzlesStatus' = if (online) _result else addingPuzzlesStatus,
      online' = online, _statusWhenOffline' = _statusWhenOffline,
    }
  }

  /// A failed stop is explained when the person has a connection again.
  action failStoppingPuzzles = all {
    _actualChoice == "stopping", _actualChoice' = "failed",
    stoppingPuzzles' = if (online) "failed" else stoppingPuzzles, _keepAddition,
  }

  /// Finishing remains possible while a stop is being considered or attempted.
  action finishAddingPuzzles = all {
    _actualStatus == "adding", _actualStatus' = "finished", stoppingPuzzles' = stoppingPuzzles, _actualChoice' = _actualChoice,
    addingPuzzlesStatus' = if (online) "finished" else addingPuzzlesStatus,
    online' = online, _statusWhenOffline' = _statusWhenOffline,
  }

  /// An addition can fail while the team considers or attempts stopping it.
  action failAddingPuzzles = all {
    _actualStatus == "adding", _actualStatus' = "failed", stoppingPuzzles' = stoppingPuzzles, _actualChoice' = _actualChoice,
    addingPuzzlesStatus' = if (online) "failed" else addingPuzzlesStatus,
    online' = online, _statusWhenOffline' = _statusWhenOffline,
  }

  /// Closing a successful confirmation returns to the current addition result.
  action followAddingPuzzles = all {
    stoppingPuzzles' = if (stoppingPuzzles == "succeeded") "idle" else stoppingPuzzles,
    _actualChoice' = if (stoppingPuzzles == "succeeded") "idle" else _actualChoice,
    addingPuzzlesStatus' = if (online) _actualStatus else addingPuzzlesStatus,
    _actualStatus' = _actualStatus, online' = online, _statusWhenOffline' = _statusWhenOffline,
  }

  action loseConnection = all {
    online, online' = false, addingPuzzlesStatus' = addingPuzzlesStatus,
    stoppingPuzzles' = stoppingPuzzles, _actualChoice' = _actualChoice, _actualStatus' = _actualStatus,
    _statusWhenOffline' = addingPuzzlesStatus,
  }

  action comeBackOnline = all {
    not(online), online' = true, addingPuzzlesStatus' = _actualStatus,
    stoppingPuzzles' = _actualChoice, _actualChoice' = _actualChoice, _actualStatus' = _actualStatus,
    _statusWhenOffline' = _statusWhenOffline,
  }

  action step = any {
    askToStopAddingPuzzles, cancelStoppingPuzzles, confirmStoppingPuzzles,
    finishStoppingPuzzles, failStoppingPuzzles, finishAddingPuzzles, failAddingPuzzles, followAddingPuzzles,
    loseConnection, comeBackOnline,
  }

  /// Every visible choice has a recognized stage and refers to a recognized result.
  val invRecognizedPuzzleLoadingChoices = all {
    Set("idle", "confirming", "stopping", "failed", "succeeded").contains(stoppingPuzzles),
    Set("ready", "adding", "finished", "failed", "stopped").contains(addingPuzzlesStatus),
  }
  /// A connected device sees the current addition result, even during confirmation.
  val invConnectedStopChoiceKeepsCurrentResult = online implies all { addingPuzzlesStatus == _actualStatus, stoppingPuzzles == _actualChoice }
  /// An offline device retains its last addition result.
  val invOfflineStopChoiceKeepsLastResult = not(online) implies addingPuzzlesStatus == _statusWhenOffline
}
