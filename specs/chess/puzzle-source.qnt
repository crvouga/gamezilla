// The team saves the Lichess file once and reuses it in every environment.
// Without a saved file, the team is asked to provide one before adding puzzles.
// An offline device keeps the last result it saw and cannot save or add puzzles.
module puzzle_source {
  /// Whether the team has saved the Lichess file for every environment to use.
  var lichessFileSaved: bool
  /// Whether the team is asked to provide the Lichess file.
  var needsLichessFile: bool
  /// Whether this environment is adding puzzles from the saved Lichess file.
  var addingPuzzles: bool
  /// Whether the team's device has a connection.
  var online: bool

  action init = {
    nondet _saved = Set(false, true).oneOf()
    all { lichessFileSaved' = _saved, needsLichessFile' = not(_saved), addingPuzzles' = false, online' = true }
  }

  /// Saving is offered only before the first Lichess file has been saved.
  action saveLichessFile = all {
    online, not(lichessFileSaved), lichessFileSaved' = true,
    needsLichessFile' = false, addingPuzzles' = addingPuzzles, online' = online,
  }

  /// Adding puzzles reuses the saved file, or asks the team to provide it first.
  action addPuzzles = all {
    lichessFileSaved' = lichessFileSaved,
    needsLichessFile' = not(lichessFileSaved),
    addingPuzzles' = if (online) lichessFileSaved else addingPuzzles, online' = online,
  }

  /// Following an addition offers the saved file, or asks for the missing file.
  action followAddingPuzzles = all {
    lichessFileSaved' = lichessFileSaved,
    needsLichessFile' = not(lichessFileSaved), addingPuzzles' = addingPuzzles, online' = online,
  }

  action loseConnection = all {
    online, online' = false, lichessFileSaved' = lichessFileSaved,
    needsLichessFile' = needsLichessFile, addingPuzzles' = addingPuzzles,
  }

  action comeBackOnline = all {
    not(online), online' = true, lichessFileSaved' = lichessFileSaved,
    needsLichessFile' = needsLichessFile, addingPuzzles' = addingPuzzles,
  }

  action step = any { saveLichessFile, addPuzzles, followAddingPuzzles, loseConnection, comeBackOnline }

  /// The team is asked for a Lichess file only when none has been saved.
  val invLichessFileNeededOnlyWhenMissing = needsLichessFile == not(lichessFileSaved)
  /// An environment cannot add puzzles until the Lichess file is available.
  val invAddingPuzzlesHasLichessFile = addingPuzzles implies lichessFileSaved
}
