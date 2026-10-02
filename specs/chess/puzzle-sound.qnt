// @model-profile: local
// Alice's device sounds preference governs puzzle and review chess feedback.
// This projection prepares the two-rook puzzle's a1 to a5 move and h7 to h6
// reply, the en passant puzzle's e5 to d6 capture, or the solved four-move
// puzzle's review at move3 before Rg2 checkmate. Chess legality and puzzle
// outcomes are already decided. Changing sounds keeps the current puzzle move.
// Heard sounds are the actual chess feedback from the most recent action,
// including silence for every class when sounds are off. Behavior is identical offline.
module puzzle_sound {
  type PuzzleSound = {kind: str, move: int, soundsOn: bool, heard: Set[str]}
  var puzzleSound: PuzzleSound
  action init = {
    nondet kind = Set("quiet puzzle", "capture puzzle", "review").oneOf()
    nondet on = Set(false, true).oneOf()
    puzzleSound' = {kind: kind, move: if (kind == "review") 3 else 1,
      soundsOn: on, heard: Set()}
  }
  /// Alice's puzzle move and its automatic opponent reply honor the preference.
  action playQuietPuzzleMove = all {
    puzzleSound.kind == "quiet puzzle", puzzleSound.move == 1,
    puzzleSound' = { ...puzzleSound, move: 3,
      heard: if (puzzleSound.soundsOn) Set("move") else Set() },
  }
  /// Alice's prepared capture honors the preference and solves its puzzle.
  action playCapturePuzzleMove = all {
    puzzleSound.kind == "capture puzzle", puzzleSound.move == 1,
    puzzleSound' = { ...puzzleSound, move: 2,
      heard: if (puzzleSound.soundsOn) Set("capture") else Set() },
  }
  /// Stepping the prepared review forward plays its legal mate with the chosen sound.
  action stepPuzzleSoundReview = all {
    puzzleSound.kind == "review", puzzleSound.move == 3,
    puzzleSound' = { ...puzzleSound, move: 4,
      heard: if (puzzleSound.soundsOn) Set("move", "check", "end") else Set() },
  }
  /// Changing the app's preference preserves puzzle progress and has no chess sound itself.
  action configurePuzzleSounds(on: bool): bool = puzzleSound' = {
    ...puzzleSound, soundsOn: on, heard: Set(),
  }
  action step = {
    nondet on = Set(false, true).oneOf()
    any {playQuietPuzzleMove, playCapturePuzzleMove, stepPuzzleSoundReview, configurePuzzleSounds(on)}
  }
  /// Muted puzzles and reviews never play any chess feedback class.
  val invPuzzleSilence = not(puzzleSound.soundsOn) implies puzzleSound.heard == Set()
  /// The prepared puzzle or review keeps its legal progress and feedback meanings.
  val invPuzzleSoundPosition =
    (puzzleSound.kind == "quiet puzzle" and Set(1, 3).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move"))) or
    (puzzleSound.kind == "capture puzzle" and Set(1, 2).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("capture"))) or
    (puzzleSound.kind == "review" and Set(3, 4).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("move", "check", "end")))
}
