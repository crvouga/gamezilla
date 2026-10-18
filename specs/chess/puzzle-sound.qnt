// @model-profile: local
// Alice's device sounds preference governs the one chess-only puzzle sound:
// the en passant puzzle's e5 to d6 capture, which solves it. Every other
// puzzle and review sound follows the same preference for every game that
// offers puzzles. Chess legality and the puzzle's outcome are already
// decided. Heard sounds are the actual chess feedback of the capture,
// including silence for every kind when sounds are off. Behavior is
// identical offline.
module puzzle_sound {
  type PuzzleSound = {kind: str, move: int, soundsOn: bool, heard: Set[str]}
  var puzzleSound: PuzzleSound
  action init = {
    nondet on = Set(false, true).oneOf()
    puzzleSound' = {kind: "capture puzzle", move: 1, soundsOn: on, heard: Set()}
  }
  /// Alice's prepared capture honors the preference and solves its puzzle.
  action playCapturePuzzleMove = all {
    puzzleSound.kind == "capture puzzle", puzzleSound.move == 1,
    puzzleSound' = { ...puzzleSound, move: 2,
      heard: if (puzzleSound.soundsOn) Set("capture", "solved", "rating gain") else Set() },
  }
  /// Nothing more happens once the puzzle is solved.
  action _wait = puzzleSound' = puzzleSound
  action step = any {playCapturePuzzleMove, _wait}
  /// A muted capture never plays any chess feedback.
  val invPuzzleSilence = not(puzzleSound.soundsOn) implies puzzleSound.heard == Set()
  /// The prepared puzzle keeps its legal progress and feedback meanings.
  val invPuzzleSoundPosition =
    puzzleSound.kind == "capture puzzle" and Set(1, 2).contains(puzzleSound.move) and
      puzzleSound.heard.subseteq(Set("capture", "solved", "rating gain"))
}
