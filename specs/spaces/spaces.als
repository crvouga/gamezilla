// Spaces and who is in them, at any one moment.
//
// A space is hosted by one person. It is open until its host ends it or
// leaves, and then it has ended. The presence of a space is who is in it
// right now; the people who joined a space are everyone who came into it and
// has not left it, whether or not they are in it right now. A person's lobby
// lists every open space they host or joined, and every open space a friend
// of theirs hosts or joined. Being friends is always mutual.
//
// What this does not say: a host may step out of their open space, so the
// host of an open space is not always in it; how many spaces a person may
// host at once is the hosting limit, which depends on Plus.

sig Person {
  // the people this person is friends with
  friend: set Person,
  // the spaces this person's lobby lists
  lobby: set Space
}

abstract sig Space {
  // the one person whose space it is
  host: one Person,
  // who is in the space right now
  presence: set Person,
  // who came into the space and has not left it
  joined: set Person
}

// a space that has not ended
sig OpenSpace extends Space {}

// a space whose host has ended it or left it
sig EndedSpace extends Space {}

// Nobody is in a space that has ended.
fact NobodyInAnEndedSpace {
  no EndedSpace.presence
}

// A person is in at most one space at a time.
fact InOneSpaceAtATime {
  all p: Person | lone presence.p
}

// A lobby lists exactly the open spaces the person or a friend of theirs hosts or joined.
fact LobbyListsOwnAndFriendsOpenSpaces {
  all p: Person | p.lobby = OpenSpace & (host + joined).(p + p.friend)
}

// Friends are always friends both ways, and nobody is their own friend.
fact FriendsBothWays {
  friend = ~friend
  no iden & friend
}

// Everyone who is in a space is in an open space.
assert EveryoneInASpaceIsInAnOpenSpace {
  all p: Person | presence.p in OpenSpace
}
check EveryoneInASpaceIsInAnOpenSpace for 5

// A host finds every open space they host in their own lobby.
assert HostsFindTheirOpenSpaces {
  all s: OpenSpace | s in s.host.lobby
}
check HostsFindTheirOpenSpaces for 5

// A friend's open space is in a person's lobby.
assert FriendsFindEachOthersOpenSpaces {
  all p: Person, s: OpenSpace | s.host in p.friend implies s in p.lobby
}
check FriendsFindEachOthersOpenSpaces for 5

// A person finds every open space they joined in their own lobby.
assert JoinersFindTheirOpenSpaces {
  all s: OpenSpace, p: s.joined | s in p.lobby
}
check JoinersFindTheirOpenSpaces for 5

// A space that has ended is in nobody's lobby.
assert EndedSpacesLeaveEveryLobby {
  no Person.lobby & EndedSpace
}
check EndedSpacesLeaveEveryLobby for 5

// A world with friends, an open space with people in it, and a space that has ended.
run { some friend and some OpenSpace.presence and some EndedSpace } for 3 expect 1
