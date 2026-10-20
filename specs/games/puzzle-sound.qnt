// @model-profile: local
// Alice's device sounds preference governs the feedback of the game's puzzles
// and their reviews. It holds for every game that offers puzzles, and runs
// once for each of them. Alice is either before the first solver move or
// reviewing the solved puzzle before its last move. The game's rules and
// puzzle outcomes are already decided. Changing sounds keeps
// the current puzzle move. Heard sounds are the actual puzzle feedback from
// the most recent action, including silence for every kind when sounds are
// off. Behavior is identical offline.
module puzzle_sound {
  /// The known puzzle's start, correct continuation and end: 1, 3 and 4
  /// with an opponent, or 0, 1 and 2 without an opponent.
  const OPPONENT: bool
  pure val OPENING: int = if (OPPONENT) 1 else 0
  pure val CONTINUATION: int = if (OPPONENT) 3 else 1
  pure val END: int = if (OPPONENT) 4 else 2
  type PuzzleSound = {kind: str, move: int, soundsOn: bool, heard: Set[str]}
  var puzzleSound: PuzzleSound
  action init = {
    nondet kind = Set("puzzle", "review").oneOf()
    nondet on = Set(false, true).oneOf()
    puzzleSound' = {kind: kind, move: if (kind == "review") END - 1 else OPENING,
      soundsOn: on, heard: Set()}
  }
  /// Alice's puzzle move, and any automatic reply, honor the preference.
  action playPuzzleMove = all {
    puzzleSound.kind == "puzzle", puzzleSound.move == OPENING,
    puzzleSound' = { ...puzzleSound, move: CONTINUATION,
      heard: if (puzzleSound.soundsOn) Set("move", "correct move") else Set() },
  }
  /// Stepping the solved review forward plays its last move with the chosen sound.
  action stepPuzzleSoundReview = all {
    puzzleSound.kind == "review", puzzleSound.move == END - 1,
    puzzleSound' = { ...puzzleSound, move: END,
      heard: if (puzzleSound.soundsOn) Set("move", "end") else Set() },
  }
  /// Changing the app's preference preserves puzzle progress and has no puzzle sound itself.
  action configurePuzzleSounds(on: bool): bool = puzzleSound' = {
    ...puzzleSound, soundsOn: on, heard: Set(),
  }
  action step = {
    nondet on = Set(false, true).oneOf()
    any {playPuzzleMove, stepPuzzleSoundReview, configurePuzzleSounds(on)}
  }
  /// Muted puzzles and reviews never play any puzzle feedback.
  val invPuzzleSilence = not(puzzleSound.soundsOn) implies puzzleSound.heard == Set()
  /// The prepared puzzle or review keeps its progress and feedback meanings.
  val invPuzzleSoundPosition =
    (puzzleSound.kind == "puzzle" and Set(OPENING, CONTINUATION).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move", "correct move"))) or
    (puzzleSound.kind == "review" and Set(END - 1, END).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move", "end")))
}
