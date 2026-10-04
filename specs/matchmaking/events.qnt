// Games receive the same complete match whenever they recover it.
module events {
  type Person = str
  type MatchmakingEvent =
    | MatchFormed({ matchmakingMatch: str, people: Set[Person] })
}
