// The team checks for the shared Lichess file before providing the first one.
// Checking and saving can take time, fail, be tried again or be stopped.
// An offline view keeps the last file it saw; reopening starts a fresh check.
module lichess_file_preparation {
  type LichessFile = { check: str, save: str, chosen: bool, available: bool, confirmingStop: bool, needsFile: bool }
  /// The file, choices and progress the team can see.
  var lichessFile: LichessFile
  /// Whether this environment is adding puzzles.
  var addingPuzzles: bool
  /// Whether the team's device has a connection.
  var online: bool
  var _saved: bool
  var _availableWhenOffline: bool

  pure def _choices(file: LichessFile): LichessFile = { ...file, needsFile: all {
    file.check == "known", not(file.available), file.save != "saving"
  } }

  action init = {
    nondet _alreadySaved = Set(false, true).oneOf()
    all {
      lichessFile' = _choices({ check: "checking", save: "idle", chosen: false, available: false, confirmingStop: false, needsFile: false }),
      addingPuzzles' = false, online' = true, _saved' = _alreadySaved, _availableWhenOffline' = false,
    }
  }

  action _keepEnvironment = all { addingPuzzles' = addingPuzzles, online' = online, _availableWhenOffline' = _availableWhenOffline }

  /// Following or checking again never treats an unanswered check as a missing file.
  action checkLichessFile = all {
    online, lichessFile.save != "saving",
    lichessFile' = _choices({ ...lichessFile, check: "checking" }), _saved' = _saved, _keepEnvironment,
  }

  /// A completed check offers the existing file or the first-file choice.
  action finishCheckingLichessFile = all {
    online, lichessFile.check == "checking",
    lichessFile' = _choices({ ...lichessFile, check: "known", available: _saved }), _saved' = _saved, _keepEnvironment,
  }

  /// A failed check preserves the last file seen and offers checking again.
  action failCheckingLichessFile = all {
    lichessFile.check == "checking",
    lichessFile' = _choices({ ...lichessFile, check: "failed" }), _saved' = _saved, _keepEnvironment,
  }

  /// Choosing a file is offered only after the shared file is known to be missing.
  action chooseLichessFile = all {
    lichessFile.check == "known", not(lichessFile.available), lichessFile.save != "saving",
    lichessFile' = _choices({ ...lichessFile, chosen: true, save: "idle" }), _saved' = _saved, _keepEnvironment,
  }

  /// Saving needs a chosen file, a connection and no other save on this device.
  action saveLichessFile = all {
    online, lichessFile.check == "known", not(lichessFile.available), lichessFile.chosen, lichessFile.save != "saving",
    lichessFile' = _choices({ ...lichessFile, save: "saving", confirmingStop: false }), _saved' = _saved, _keepEnvironment,
  }

  /// Only a completed save makes a file available; it never starts adding puzzles.
  action finishSavingLichessFile = all {
    online, lichessFile.save == "saving",
    lichessFile' = _choices({ check: "known", save: "idle", chosen: false, available: true, confirmingStop: false, needsFile: false }),
    _saved' = true, _keepEnvironment,
  }

  /// Failure keeps the chosen file available for another attempt, without publishing it.
  action failSavingLichessFile = all {
    lichessFile.save == "saving",
    lichessFile' = _choices({ ...lichessFile, save: "failed", confirmingStop: false }), _saved' = _saved, _keepEnvironment,
  }

  /// Asking to stop leaves saving in progress until the team confirms.
  action askToStopSavingLichessFile = all {
    lichessFile.save == "saving", not(lichessFile.confirmingStop),
    lichessFile' = _choices({ ...lichessFile, confirmingStop: true }), _saved' = _saved, _keepEnvironment,
  }

  /// Cancelling the stop keeps the same file being saved.
  action cancelStoppingLichessFile = all {
    lichessFile.confirmingStop,
    lichessFile' = _choices({ ...lichessFile, confirmingStop: false }), _saved' = _saved, _keepEnvironment,
  }

  /// Confirming stops only the unfinished save, preserving any completed shared file.
  action confirmStoppingLichessFile = all {
    lichessFile.confirmingStop,
    lichessFile' = _choices({ ...lichessFile, save: "stopped", confirmingStop: false }), _saved' = _saved, _keepEnvironment,
  }

  /// A file saved by another environment becomes visible on the next completed check.
  action anotherEnvironmentSavesLichessFile = all {
    not(_saved), _saved' = true, lichessFile' = lichessFile, _keepEnvironment,
  }

  /// Adding puzzles uses the last complete file seen and needs a connection.
  action addPuzzles = all {
    online, lichessFile.available, lichessFile.save != "saving",
    addingPuzzles' = true, lichessFile' = lichessFile, _saved' = _saved,
    online' = online, _availableWhenOffline' = _availableWhenOffline,
  }

  /// Leaving stops an unfinished save; returning checks before showing the saved file.
  action returnToLichessFile = all {
    lichessFile' = _choices({ check: if (online) "checking" else "offline", save: "idle", chosen: false,
      available: false, confirmingStop: false, needsFile: false }),
    _saved' = _saved, addingPuzzles' = addingPuzzles, online' = online, _availableWhenOffline' = false,
  }

  action loseConnection = all {
    online, online' = false, addingPuzzles' = addingPuzzles, _saved' = _saved,
    lichessFile' = _choices({ ...lichessFile,
      check: if (lichessFile.check == "checking") "offline" else lichessFile.check,
      save: if (lichessFile.save == "saving") "failed" else lichessFile.save, confirmingStop: false }),
    _availableWhenOffline' = lichessFile.available,
  }

  action comeBackOnline = all {
    not(online), online' = true, addingPuzzles' = addingPuzzles, _saved' = _saved,
    lichessFile' = _choices({ ...lichessFile, check: "checking" }), _availableWhenOffline' = _availableWhenOffline,
  }

  action step = any {
    checkLichessFile, finishCheckingLichessFile, failCheckingLichessFile, chooseLichessFile,
    saveLichessFile, finishSavingLichessFile, failSavingLichessFile,
    askToStopSavingLichessFile, cancelStoppingLichessFile, confirmStoppingLichessFile,
    anotherEnvironmentSavesLichessFile, addPuzzles, returnToLichessFile, loseConnection, comeBackOnline,
  }

  /// Unknown and failed checks never claim a file is missing or replace the last known file.
  val invLichessFileChoices = all {
    Set("checking", "known", "failed", "offline").contains(lichessFile.check),
    Set("idle", "saving", "failed", "stopped").contains(lichessFile.save),
    lichessFile.confirmingStop implies lichessFile.save == "saving",
    lichessFile.needsFile == all { lichessFile.check == "known", not(lichessFile.available), lichessFile.save != "saving" },
  }
  /// Only a complete shared file can be shown as available or used to add puzzles.
  val invOnlyCompleteLichessFilesAreAvailable = all {
    lichessFile.available implies _saved, addingPuzzles implies _saved,
    lichessFile.save == "saving" implies all { lichessFile.chosen, not(lichessFile.available) },
  }
  /// Losing the connection keeps the last complete file in the current view.
  val invOfflineFileAvailabilityPreserved = not(online) implies lichessFile.available == _availableWhenOffline
}
