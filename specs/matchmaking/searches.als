// A person owns their waits across devices. Earlier matches are history;
// only their current wait can be waiting for a new match.
sig Seeker {
  owns: set Search,
  current: lone Search
}
sig MatchingPool {}
sig GroupSize { seats: some Seat }
sig Seat {}
abstract sig SearchState {}
one sig WaitingSearch, StoppedSearch, MatchedSearch extends SearchState {}
sig Search {
  pool: one MatchingPool,
  state: one SearchState,
  requestedSize: one GroupSize,
  assignment: lone MatchGroup
}
sig MatchGroup {
  waits: some Search,
  people: some Seeker,
  requestedSize: one GroupSize,
  seating: Search -> Seat
}

fact ARequestedGroupHasAtLeastTwoPlaces {
  all size: GroupSize | some disj a, b: size.seats | a != b
}

fact EachWaitHasOneOwner {
  all s: Search | one owns.s
  all p: Seeker | p.current in p.owns
}
fact OnlyTheCurrentWaitMayWait {
  all p: Seeker | {s: p.owns | s.state = WaitingSearch} in p.current
}
fact MatchedWaitsHaveExactlyOneMatch {
  all s: Search | (s.state = MatchedSearch iff one s.assignment)
  assignment = ~waits
}
fact ACompleteGroupHasDistinctPeopleInOnePool {
  all g: MatchGroup {
    some disj a, b: g.waits | a != b
    g.people = owns.(g.waits)
    all p: g.people | one p.owns & g.waits
    one g.waits.pool
    g.waits.requestedSize = g.requestedSize
    g.seating in g.waits -> g.requestedSize.seats
    all s: g.waits | one s.(g.seating)
    all place: g.requestedSize.seats | one (g.seating).place
  }
}

assert EveryRequestedPlaceIsFilledOnce {
  all g: MatchGroup | all place: g.requestedSize.seats | one (g.seating).place
}
check EveryRequestedPlaceIsFilledOnce for 6

assert OneActiveWaitPerPerson {
  all p: Seeker | lone {s: p.owns | s.state = WaitingSearch}
}
check OneActiveWaitPerPerson for 6
assert ExactlyOneAssignmentPerWait {
  all s: Search | lone waits.s
}
check ExactlyOneAssignmentPerWait for 6
assert NoStoppedWaitIsMatched {
  no {s: Search | s.state = StoppedSearch} & MatchGroup.waits
}
check NoStoppedWaitIsMatched for 6
assert APersonHasOneCurrentMatch {
  all p: Seeker | lone p.current.assignment
}
check APersonHasOneCurrentMatch for 6
run {
  some g: MatchGroup | some disj a, b: Seeker | g.people = a + b
  some s: Search | s.state = WaitingSearch
} for 5 expect 1
