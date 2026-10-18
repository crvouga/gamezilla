// The puzzles a solver's game log and puzzle rating count, at one moment,
// at one game offering puzzles; it holds for each of them, and each game's
// game log and puzzle rating are its own.
// Returning, retrying or watching cannot give the same solver two first
// results for one puzzle. The rating and game log agree on that result.

sig Solver {}
sig Puzzle {}
abstract sig Result {}
one sig Solved, Failed, Abandoned extends Result {}

sig PlayedPuzzle {
  solver: one Solver,
  puzzle: one Puzzle,
  result: one Result
}

sig RatedPuzzle {
  solver: one Solver,
  puzzle: one Puzzle,
  result: one Result
}

// A solver's game log counts the first result of each puzzle once.
fact OnePlayedResult {
  all disj a, b: PlayedPuzzle | a.solver != b.solver or a.puzzle != b.puzzle
}

// A solver's puzzle rating counts each puzzle at most once.
fact OneRatedResult {
  all disj a, b: RatedPuzzle | a.solver != b.solver or a.puzzle != b.puzzle
}

// A rated puzzle and the game log show the same solver, puzzle and result.
fact RatingAgreesWithGameLog {
  all r: RatedPuzzle | one l: PlayedPuzzle |
    r.solver = l.solver and r.puzzle = l.puzzle and r.result = l.result
}

// Retrying cannot give the solver both a solved and a failed first result.
assert OneFirstResultPerSolver {
  all s: Solver, p: Puzzle | lone { l: PlayedPuzzle | l.solver = s and l.puzzle = p }
}
check OneFirstResultPerSolver for 6

// Every puzzle that changes a rating also appears in that solver's game log.
assert ACountedRatingHasTheSameLog {
  all r: RatedPuzzle | some l: PlayedPuzzle |
    l.solver = r.solver and l.puzzle = r.puzzle and l.result = r.result
}
check ACountedRatingHasTheSameLog for 6

// Different solvers may solve the same puzzle without sharing progress.
run {
  some disj a, b: PlayedPuzzle |
    a.puzzle = b.puzzle and a.solver != b.solver and
    a.result = Solved and b.result = Failed
  some RatedPuzzle
} for 4 expect 1
