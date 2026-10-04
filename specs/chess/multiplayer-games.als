// Every accepted chess matchmaking match has one complete private game.
// Earlier games remain history; a person has at most one unfinished game.
sig PlayPerson { currentPlay: lone PlayGame }
sig MatchmakingMatch { matchedPeople: some PlayPerson }
sig PlayBoard {}
abstract sig PlayState {}
one sig UnfinishedPlay, WonGame, DrawnGame extends PlayState {}
sig PlayGame {
  fromMatch: one MatchmakingMatch,
  whiteSide: one PlayPerson,
  blackSide: one PlayPerson,
  playBoard: one PlayBoard,
  playState: one PlayState,
  winner: lone PlayPerson
}

fact OneCompleteGamePerMatch {
  all m: MatchmakingMatch | one fromMatch.m
  all g: PlayGame {
    g.whiteSide != g.blackSide
    g.fromMatch.matchedPeople = g.whiteSide + g.blackSide
    one playBoard.(g.playBoard)
  }
}
fact CurrentGamesBelongToTheirPeople {
  all p: PlayPerson | some p.currentPlay implies
    p in p.currentPlay.whiteSide + p.currentPlay.blackSide
  all g: PlayGame | g.playState = UnfinishedPlay implies
    g.whiteSide.currentPlay = g and g.blackSide.currentPlay = g
}
fact AResultHasAnHonestWinner {
  all g: PlayGame {
    g.playState = WonGame iff one g.winner
    g.winner in g.whiteSide + g.blackSide
  }
}

assert OneUnfinishedGamePerPerson {
  all p: PlayPerson | lone {g: PlayGame |
    g.playState = UnfinishedPlay and p in g.whiteSide + g.blackSide}
}
check OneUnfinishedGamePerPerson for 6
assert NoDuplicateMatchHandoff {
  all m: MatchmakingMatch | one fromMatch.m
}
check NoDuplicateMatchHandoff for 6
assert DifferentPeoplePlayOppositeSides {
  all g: PlayGame | g.whiteSide != g.blackSide
}
check DifferentPeoplePlayOppositeSides for 6
assert ADrawHasNoWinner {
  all g: PlayGame | g.playState = DrawnGame implies no g.winner
}
check ADrawHasNoWinner for 6
run {
  some disj old, fresh: PlayGame {
    old.playState = WonGame
    fresh.playState = UnfinishedPlay
    old.whiteSide = fresh.whiteSide
  }
} for 5 expect 1
