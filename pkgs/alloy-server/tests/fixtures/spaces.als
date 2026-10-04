-- Spaces: every space has exactly one host, and the host is one of its members.
sig Person {}

sig Space {
  host: one Person,
  members: set Person
}

fact HostIsMember { all s: Space | s.host in s.members }

assert HostIsAlwaysMember { all s: Space | s.host in s.members }
check HostIsAlwaysMember for 4

run SomeSpace { some Space } for 3 expect 1
