// Every accepted pairing has one complete matched game of the game, and
// every other matched game is a rematch of a finished one: the same two
// people at the same clock choice with the sides swapped. Earlier matched
// games remain history; a person has at most one unfinished matched game. An
// aborted matched game has no winner. This structure concerns no sequence of
// actions.
module matched_games
sig Person { currentPlay: lone PlayGame }
sig Pairing { pairedPeople: some Person }
sig PlayBoard {}
sig ClockChoice {}
abstract sig PlayState {}
one sig UnfinishedPlay, WonGame, DrawnGame, AbortedGame extends PlayState {}
sig PlayGame {
  fromPairing: lone Pairing,
  rematchOf: lone PlayGame,
  clockChoice: one ClockChoice,
  firstSide: one Person,
  secondSide: one Person,
  playBoard: one PlayBoard,
  playState: one PlayState,
  winner: lone Person
}

fact OneCompleteGamePerPairing {
  all m: Pairing | one fromPairing.m
  all g: PlayGame {
    g.firstSide != g.secondSide
    some g.fromPairing implies g.fromPairing.pairedPeople = g.firstSide + g.secondSide
    one playBoard.(g.playBoard)
  }
}
fact EveryGameComesFromAPairingOrARematch {
  all g: PlayGame | one g.fromPairing iff no g.rematchOf
}
fact ARematchSwapsTheSidesAtTheSameClockChoice {
  all g: PlayGame | some g.rematchOf implies {
    g.firstSide = g.rematchOf.secondSide
    g.secondSide = g.rematchOf.firstSide
    g.clockChoice = g.rematchOf.clockChoice
    g.rematchOf.playState in WonGame + DrawnGame
  }
  all g: PlayGame | lone rematchOf.g
  no g: PlayGame | g in g.^rematchOf
}
fact CurrentGamesBelongToTheirPeople {
  all p: Person | some p.currentPlay implies
    p in p.currentPlay.firstSide + p.currentPlay.secondSide
  all g: PlayGame | g.playState = UnfinishedPlay implies
    g.firstSide.currentPlay = g and g.secondSide.currentPlay = g
}
fact AResultHasAnHonestWinner {
  all g: PlayGame {
    g.playState = WonGame iff one g.winner
    g.winner in g.firstSide + g.secondSide
  }
}

assert OneUnfinishedGamePerPerson {
  all p: Person | lone {g: PlayGame |
    g.playState = UnfinishedPlay and p in g.firstSide + g.secondSide}
}
check OneUnfinishedGamePerPerson for 6
assert NoDuplicatePairingHandoff {
  all m: Pairing | one fromPairing.m
}
check NoDuplicatePairingHandoff for 6
assert DifferentPeoplePlayOppositeSides {
  all g: PlayGame | g.firstSide != g.secondSide
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
