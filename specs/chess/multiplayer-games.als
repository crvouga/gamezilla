// Every accepted chess matchmaking match has one complete private game, and
// every other multiplayer game is a rematch of a finished one: the same two
// people at the same time control with colours swapped. Earlier games remain
// history; a person has at most one unfinished game. An aborted game has no
// winner.
sig PlayPerson { currentPlay: lone PlayGame }
sig MatchmakingMatch { matchedPeople: some PlayPerson }
sig PlayBoard {}
sig TimeControl {}
abstract sig PlayState {}
one sig UnfinishedPlay, WonGame, DrawnGame, AbortedGame extends PlayState {}
sig PlayGame {
  fromMatch: lone MatchmakingMatch,
  rematchOf: lone PlayGame,
  timeControl: one TimeControl,
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
    some g.fromMatch implies g.fromMatch.matchedPeople = g.whiteSide + g.blackSide
    one playBoard.(g.playBoard)
  }
}
fact EveryGameComesFromAMatchOrARematch {
  all g: PlayGame | one g.fromMatch iff no g.rematchOf
}
fact ARematchSwapsColoursAtTheSameTimeControl {
  all g: PlayGame | some g.rematchOf implies {
    g.whiteSide = g.rematchOf.blackSide
    g.blackSide = g.rematchOf.whiteSide
    g.timeControl = g.rematchOf.timeControl
    g.rematchOf.playState in WonGame + DrawnGame
  }
  all g: PlayGame | lone rematchOf.g
  no g: PlayGame | g in g.^rematchOf
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
assert AnAbortedGameHasNoWinner {
  all g: PlayGame | g.playState = AbortedGame implies no g.winner
}
check AnAbortedGameHasNoWinner for 6
assert NoRematchOfAnAbortedGame {
  no g: PlayGame | some g.rematchOf and g.rematchOf.playState = AbortedGame
}
check NoRematchOfAnAbortedGame for 6
run {
  some disj old, fresh: PlayGame {
    old.playState = WonGame
    fresh.playState = UnfinishedPlay
    fresh.rematchOf = old
  }
} for 5 expect 1
