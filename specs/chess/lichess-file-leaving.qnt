// The team chooses whether to stop an unfinished Lichess file by leaving.
// Staying keeps saving; a completed file needs no departure confirmation.
// Losing the connection stops unfinished saving, so a requested departure can proceed.
module lichess_file_leaving {
  var savingLichessFile: bool
  var followingAddingPuzzles: bool
  var leavingAddingPuzzles: bool
  var online: bool

  action init = all {
    savingLichessFile' = true, followingAddingPuzzles' = true, leavingAddingPuzzles' = false, online' = true,
  }

  action _keepConnection = online' = online

  /// Asking to leave keeps the same unfinished file being saved.
  action askToLeaveAddingPuzzles = all {
    followingAddingPuzzles, savingLichessFile, not(leavingAddingPuzzles),
    leavingAddingPuzzles' = true, followingAddingPuzzles' = true, savingLichessFile' = true,
    _keepConnection,
  }

  /// Staying keeps the file and its current progress.
  action cancelLeavingAddingPuzzles = all {
    leavingAddingPuzzles, leavingAddingPuzzles' = false,
    followingAddingPuzzles' = true, savingLichessFile' = savingLichessFile,
    _keepConnection,
  }

  /// Confirming leaves and stops only an unfinished save.
  action confirmLeavingAddingPuzzles = all {
    leavingAddingPuzzles, followingAddingPuzzles' = false,
    savingLichessFile' = false, leavingAddingPuzzles' = false,
    _keepConnection,
  }

  /// Finishing makes a requested departure safe without stopping the completed file.
  action finishSavingLichessFile = all {
    online, savingLichessFile, savingLichessFile' = false,
    followingAddingPuzzles' = all { followingAddingPuzzles, not(leavingAddingPuzzles) }, leavingAddingPuzzles' = false,
    _keepConnection,
  }

  /// Leaving after completion does not ask to stop a completed file.
  action leaveAddingPuzzles = all {
    followingAddingPuzzles, not(savingLichessFile), not(leavingAddingPuzzles),
    followingAddingPuzzles' = false, savingLichessFile' = false, leavingAddingPuzzles' = false,
    _keepConnection,
  }

  /// Returning never starts the unfinished save again.
  action returnToLichessFile = all {
    not(followingAddingPuzzles), followingAddingPuzzles' = true,
    savingLichessFile' = false, leavingAddingPuzzles' = false,
    _keepConnection,
  }

  /// Without a connection unfinished saving stops and a requested departure can proceed.
  action loseConnection = all {
    online, online' = false, savingLichessFile' = false,
    followingAddingPuzzles' = all { followingAddingPuzzles, not(leavingAddingPuzzles) }, leavingAddingPuzzles' = false,
  }

  /// Returning online never starts an unfinished save again.
  action comeBackOnline = all {
    not(online), online' = true, savingLichessFile' = savingLichessFile,
    followingAddingPuzzles' = followingAddingPuzzles, leavingAddingPuzzles' = leavingAddingPuzzles,
  }

  action step = any {
    askToLeaveAddingPuzzles, cancelLeavingAddingPuzzles, confirmLeavingAddingPuzzles,
    finishSavingLichessFile, leaveAddingPuzzles, returnToLichessFile, loseConnection, comeBackOnline,
  }

  /// An unanswered departure choice keeps the team with adding puzzles.
  val invDepartureWaitsForConfirmation = leavingAddingPuzzles implies all { followingAddingPuzzles, savingLichessFile }
  /// An unfinished save never continues after the team confirms leaving.
  val invConfirmedDepartureStopsUnfinishedSaving = not(followingAddingPuzzles) implies all {
    not(savingLichessFile), not(leavingAddingPuzzles),
  }
  /// A file cannot continue saving without a connection.
  val invOfflineDepartureHasNoUnfinishedSave = not(online) implies not(savingLichessFile)
}
