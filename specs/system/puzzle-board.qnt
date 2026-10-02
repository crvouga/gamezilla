// @spec-interpretation
// Sources: specs/chess
// Representative board states; move legality is a correct/wrong equivalence
// class. Separate result delivery permits a completed room and pending rating.
module puzzle_board {
  import universe.* from "./universe"
  type PuzzleBoard = { puzzle: int, actor: int, phase: str, position: int, generation: int, visible: bool }
  pure val boardEmpty: PuzzleBoard = { puzzle: -1, actor: -1, phase: "none", position: 0, generation: 0, visible: false }
  pure val boardKINDS = Set("board-open", "board-correct", "board-wrong", "board-reveal", "board-skip", "board-reset", "board-exit")
  pure def boardOver(b: PuzzleBoard): bool = Set("solved","revealed","skipped").contains(b.phase)
  pure def boardChange(b: PuzzleBoard, kind: str, actor: int, puzzle: int): PuzzleBoard =
    if (kind == "board-open" and (b.phase == "none" or boardOver(b)))
      { puzzle: puzzle, actor: actor, phase: "solving", position: 0, generation: b.generation + 1, visible: true }
    else if (kind == "board-open") { ...b, visible: true }
    else if (b.actor != actor or b.phase == "none" or not(b.visible)) b
    else if (kind == "board-exit") { ...b, visible: false }
    else if (kind == "board-reset") { ...b, phase: "solving", position: 0 }
    else if (kind == "board-reveal" and Set("solving","wrong").contains(b.phase)) { ...b, phase: "revealed" }
    else if (kind == "board-skip" and Set("solving","wrong").contains(b.phase)) { ...b, phase: "skipped" }
    else if (b.phase != "solving") b
    else if (kind == "board-correct") { ...b, position: b.position + 1, phase: if (b.position == 1) "solved" else "solving" }
    else if (kind == "board-wrong") { ...b, phase: "wrong" }
    else b
  pure def boardValid(b: PuzzleBoard): bool = and {
    Set("none","solving","wrong","solved","revealed","skipped").contains(b.phase),
    b.phase != "none" implies PEOPLE.contains(b.actor) and PUZZLES.contains(b.puzzle),
    b.position >= 0 and b.position <= 2,
    b.phase == "solved" implies b.position == 2,
  }
}
