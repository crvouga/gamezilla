// Legal Custom Game worlds: the creator belongs to its space and may watch;
// each game owns one White and one Black side. Only a person or invitation
// names someone, one person cannot control both sides, and started games
// have two participants. This structure concerns no sequence of actions.
module custom_games
sig Person {}
abstract sig Color {}
one sig White, Black extends Color {}
abstract sig ParticipantKind {}
one sig OpenPlace, ClosedSide, PersonSide, BotSide, InvitedSide extends ParticipantKind {}
abstract sig CustomGameStatus {}
one sig Configuring, Active, Completed, Cancelled extends CustomGameStatus {}
sig Side {
  color: one Color,
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
  white: one Side,
  black: one Side,
  status: one CustomGameStatus,
  ready: set Side,
  started: lone CustomGame
}
fact CreatorIsHost { all g: CustomGame | g.status in Configuring + Active implies g.creator = g.space.spaceHost }
fact OneCurrentGame {
  all s: Space | s.current in s.~space
  all g: CustomGame | g.status in Configuring + Active implies g.space.current = g
}
fact CreatorBelongsToSpace { all g: CustomGame | g.status in Configuring + Active implies g.creator in g.space.peopleInSpace }
fact OneSidePerColor {
  all g: CustomGame | g.white != g.black and g.white.color = White and g.black.color = Black
  all s: Side | one g: CustomGame | s in g.white + g.black
}
fact OnlyPeopleAndInvitationsNamePeople {
  all s: Side | (s.kind in PersonSide + InvitedSide implies one s.person) and
    (s.kind not in PersonSide + InvitedSide implies no s.person)
}
fact OnePersonPerGame {
  all g: CustomGame | no g.white.person & g.black.person
  all g: CustomGame | g.status in Configuring + Active implies (g.white.person + g.black.person) in g.space.peopleInSpace
}
fact ReadyPeopleOnly { all g: CustomGame | g.ready in (g.white + g.black) & kind.PersonSide }
fact StartedGamesHaveTwoParticipants {
  all g: CustomGame | some g.started implies
    g.started = g and (g.white.kind + g.black.kind) in PersonSide + BotSide
  all g: CustomGame | g.status = Configuring implies no g.started
  all g: CustomGame | g.status = Completed implies some g.started
  all g: CustomGame | g.status = Active implies some g.started and
    ((g.white + g.black) & kind.PersonSide) in g.ready
}
fact NoTerminalInvitations { all g: CustomGame | g.status in Completed + Cancelled implies
  (g.white.kind + g.black.kind) in OpenPlace + ClosedSide + PersonSide + BotSide }
assert ExclusiveControl { all g: CustomGame | no g.white.person & g.black.person }
assert NoOpenParticipant { all s: Side | s.kind = OpenPlace implies no s.person }
assert StartHasTwoParticipants { all g: CustomGame | some g.started implies
  (g.white.kind + g.black.kind) in PersonSide + BotSide }
assert CreatorCanWatch { all g: CustomGame | g.status = Active implies g.creator in g.space.peopleInSpace }
check ExclusiveControl for 6
check NoOpenParticipant for 6
check StartHasTwoParticipants for 6
check CreatorCanWatch for 6
pred WatchingCreator { some g: CustomGame | g.status = Active and
  g.white.kind = BotSide and g.black.kind = BotSide and no (g.white.person + g.black.person) }
run WatchingCreator for 6 expect 1
pred TwoPeople { some g: CustomGame | g.status = Active and
  g.white.kind = PersonSide and g.black.kind = PersonSide }
run TwoPeople for 6 expect 1
