// @spec-interpretation
// Sources: specs/chess, specs/matchmaking, specs/room
// Quota charges, first-result rating and room/match lifecycle.
// Chess move legality and rating arithmetic remain in their existing focused suites.
module play {
  import universe.* from "./universe"
  export universe.*
  type PlayState = {
    unobserved: Set[(int,int,str)], outcomes: Set[(int,int,str)], charges: Set[(int, int, int)], rated: Set[(int, int)], results: (int, int) -> str,
    waiting: Set[int], matches: int -> (int,int), finished: Set[int], nextMatch: int,
    roomMoves: int -> int,
  }
  pure val gameLIMIT = 2
  pure val gameInitial: PlayState = {
    unobserved: Set(), outcomes: Set(), charges: Set(), rated: Set(), results: tuples(PEOPLE,PUZZLES).mapBy(_ => "unstarted"),
    waiting: Set(), matches: Map(), finished: Set(), nextMatch: 0, roomMoves: SPACES.mapBy(_ => 0),
  }
  pure def gameUsed(s: PlayState, p: int, day: int): int = s.charges.filter(k => k._1 == p and k._3 == day).size()
  pure def gameCharged(s: PlayState, p: int, puzzle: int): bool = s.charges.exists(k => k._1 == p and k._2 == puzzle)
  pure def gameStart(s: PlayState, p: int, puzzle: int, day: int): PlayState =
    if (gameCharged(s,p,puzzle)) s else { ...s, charges: s.charges.union(Set((p, puzzle, day))),
      results: s.results.set((p, puzzle), if (s.rated.contains((p,puzzle))) s.results.get((p,puzzle)) else "playing") }
  pure def gameFinish(s: PlayState, p: int, puzzle: int, outcome: str): PlayState =
    if (s.rated.contains((p,puzzle)) or not(gameCharged(s,p,puzzle))) s
    else { ...s, rated: s.rated.union(Set((p,puzzle))), results: s.results.set((p,puzzle),outcome) }
  pure def gameMatchPair(s: PlayState, a: int, b: int): PlayState = {
    val ab = if (a < b) (a,b) else (b,a)
    if (a == b or not(s.waiting.contains(a)) or not(s.waiting.contains(b))) s
    else { ...s, waiting: s.waiting.exclude(Set(a,b)), matches: s.matches.put(s.nextMatch,ab), nextMatch: s.nextMatch + 1 }
  }
  pure def gameErase(s: PlayState, p: int): PlayState = {
    ...s, unobserved: s.unobserved.filter(k => k._1 != p), outcomes: s.outcomes.filter(k => k._1 != p), charges: s.charges.filter(k => k._1 != p), rated: s.rated.filter(k => k._1 != p),
    results: s.results.keys().mapBy(k => if (k._1 == p) "unstarted" else s.results.get(k)),
    waiting: s.waiting.exclude(Set(p)),
    matches: s.matches.keys().filter(id => s.matches.get(id)._1 != p and s.matches.get(id)._2 != p).mapBy(id => s.matches.get(id)),
    finished: s.finished.filter(id => s.matches.get(id)._1 != p and s.matches.get(id)._2 != p),
  }
  pure def gameValid(s: PlayState): bool = and {
    s.outcomes.union(s.unobserved).forall(o => PEOPLE.contains(o._1) and PUZZLES.contains(o._2) and Set("solved","failed","abandoned").contains(o._3)),
    s.rated.forall(k => gameCharged(s,k._1,k._2)),
    s.rated.forall(k => Set("solved", "failed", "abandoned").contains(s.results.get(k))),
    s.finished.subseteq(s.matches.keys()),
    s.matches.keys().forall(id => s.matches.get(id)._1 < s.matches.get(id)._2),
    PEOPLE.forall(p => s.matches.keys().filter(id => not(s.finished.contains(id)) and (s.matches.get(id)._1 == p or s.matches.get(id)._2 == p)).size() <= 1),
    s.waiting.forall(p => not(s.matches.keys().exists(id => not(s.finished.contains(id)) and (s.matches.get(id)._1 == p or s.matches.get(id)._2 == p)))),
    SPACES.forall(id => s.roomMoves.get(id) >= 0),
  }
}
