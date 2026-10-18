// @model-profile: local
// Alice's device sounds preference governs the feedback of the game's puzzles
// and their reviews. It holds for every game that offers puzzles, and runs
// once for each of them. Alice is either solving the game's known puzzle at
// move 1, before the next move of the solution and the opponent's reply, or
// reviewing it solved at move 3, before the last move of the solution. The
// game's rules and puzzle outcomes are already decided. Changing sounds keeps
// the current puzzle move. Heard sounds are the actual puzzle feedback from
// the most recent action, including silence for every kind when sounds are
// off. Behavior is identical offline.
module puzzle_sound {
  type PuzzleSound = {kind: str, move: int, soundsOn: bool, heard: Set[str]}
  var puzzleSound: PuzzleSound
  action init = {
    nondet kind = Set("puzzle", "review").oneOf()
    nondet on = Set(false, true).oneOf()
    puzzleSound' = {kind: kind, move: if (kind == "review") 3 else 1,
      soundsOn: on, heard: Set()}
  }
  /// Alice's puzzle move and its automatic opponent reply honor the preference.
  action playPuzzleMove = all {
    puzzleSound.kind == "puzzle", puzzleSound.move == 1,
    puzzleSound' = { ...puzzleSound, move: 3,
      heard: if (puzzleSound.soundsOn) Set("move", "correct move") else Set() },
  }
  /// Stepping the solved review forward plays its last move with the chosen sound.
  action stepPuzzleSoundReview = all {
    puzzleSound.kind == "review", puzzleSound.move == 3,
    puzzleSound' = { ...puzzleSound, move: 4,
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
    (puzzleSound.kind == "puzzle" and Set(1, 3).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move", "correct move"))) or
    (puzzleSound.kind == "review" and Set(3, 4).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move", "end")))
}
