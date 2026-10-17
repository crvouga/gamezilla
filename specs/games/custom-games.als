// Legal custom game worlds: the creator belongs to its space and may watch;
// each custom game has its own first side and its own second side. Only a
// person or an invitation names someone, one person cannot play both sides,
// and started custom games have two participants. This structure concerns no
// sequence of actions.
module custom_games
sig Person {}
abstract sig ParticipantKind {}
one sig OpenSide, ClosedSide, PersonSide, BotSide, InvitedSide extends ParticipantKind {}
abstract sig CustomGameStatus {}
one sig SettingUp, UnderWay, Finished, Cancelled extends CustomGameStatus {}
sig Side {
  kind: one ParticipantKind,
  person: lone Person
}
sig Space {
  spaceHost: lone Person,
  peopleInSpace: set Person,
  current: lone CustomGame
}
sig CustomGame {
  space: one Space,
  creator: one Person,
  firstSide: one Side,
  secondSide: one Side,
  status: one CustomGameStatus,
  ready: set Side,
  started: lone CustomGame
}
fact CreatorIsHost { all g: CustomGame | g.status in SettingUp + UnderWay implies g.creator = g.space.spaceHost }
fact OneCurrentGame {
  all s: Space | s.current in s.~space
  all g: CustomGame | g.status in SettingUp + UnderWay implies g.space.current = g
}
fact CreatorBelongsToSpace { all g: CustomGame | g.status in SettingUp + UnderWay implies g.creator in g.space.peopleInSpace }
fact TwoSidesPerGame {
  all g: CustomGame | g.firstSide != g.secondSide
  all s: Side | one g: CustomGame | s in g.firstSide + g.secondSide
}
fact OnlyPeopleAndInvitationsNamePeople {
  all s: Side | (s.kind in PersonSide + InvitedSide implies one s.person) and
    (s.kind not in PersonSide + InvitedSide implies no s.person)
}
fact OnePersonPerGame {
  all g: CustomGame | no g.firstSide.person & g.secondSide.person
  all g: CustomGame | g.status in SettingUp + UnderWay implies (g.firstSide.person + g.secondSide.person) in g.space.peopleInSpace
}
fact ReadyPeopleOnly { all g: CustomGame | g.ready in (g.firstSide + g.secondSide) & kind.PersonSide }
fact StartedGamesHaveTwoParticipants {
  all g: CustomGame | some g.started implies
    g.started = g and (g.firstSide.kind + g.secondSide.kind) in PersonSide + BotSide
  all g: CustomGame | g.status = SettingUp implies no g.started
  all g: CustomGame | g.status = Finished implies some g.started
  all g: CustomGame | g.status = UnderWay implies some g.started and
    ((g.firstSide + g.secondSide) & kind.PersonSide) in g.ready
}
fact NoInvitationsOnceOver { all g: CustomGame | g.status in Finished + Cancelled implies
  (g.firstSide.kind + g.secondSide.kind) in OpenSide + ClosedSide + PersonSide + BotSide }
assert ExclusiveSides { all g: CustomGame | no g.firstSide.person & g.secondSide.person }
assert NoOpenParticipant { all s: Side | s.kind = OpenSide implies no s.person }
assert StartHasTwoParticipants { all g: CustomGame | some g.started implies
  (g.firstSide.kind + g.secondSide.kind) in PersonSide + BotSide }
assert CreatorCanWatch { all g: CustomGame | g.status = UnderWay implies g.creator in g.space.peopleInSpace }
check ExclusiveSides for 6
check NoOpenParticipant for 6
check StartHasTwoParticipants for 6
check CreatorCanWatch for 6
pred WatchingCreator { some g: CustomGame | g.status = UnderWay and
  g.firstSide.kind = BotSide and g.secondSide.kind = BotSide and no (g.firstSide.person + g.secondSide.person) }
run WatchingCreator for 6 expect 1
pred TwoPeople { some g: CustomGame | g.status = UnderWay and
  g.firstSide.kind = PersonSide and g.secondSide.kind = PersonSide }
run TwoPeople for 6 expect 1
