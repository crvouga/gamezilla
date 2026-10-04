-- The spaces model with an assertion it cannot keep: nobody forces a person
-- into a space, so a person outside every space is a counterexample.
sig Person {}

sig Space {
  host: one Person,
  members: set Person
}

fact HostIsMember { all s: Space | s.host in s.members }

assert HostIsAlwaysMember { all s: Space | s.host in s.members }
check HostIsAlwaysMember for 4

assert EveryoneBelongsSomewhere { all p: Person | some members.p }
check EveryoneBelongsSomewhere for 3

run SomeSpace { some Space } for 3 expect 1

run LonelySpace { some s: Space | no s.members } for 3
