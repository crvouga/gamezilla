// Friendships, friend requests and blocks, at any one moment.
//
// Two people are friends, or one has sent the other a friend request that
// waits for an answer, or one has blocked the other, or they are strangers.
// Never more than one of these at once, and never with oneself.
//
// What this does not say: a friend request declined in the last day, which
// makes asking again refused, depends on time.

sig Person {
  // the people this person is friends with
  friend: set Person,
  // the people this person has sent a friend request that still waits
  friendRequests: set Person,
  // the people this person has blocked
  blocks: set Person
}

// Friendship is mutual.
fact FriendsBothWays {
  friend = ~friend
}

// Nobody is their own friend, asks themselves, or blocks themselves.
fact NothingWithOneself {
  no iden & (friend + friendRequests + blocks)
}

// Between two people, at most one friend request waits, one way.
fact OneFriendRequestBetweenTwo {
  no friendRequests & ~friendRequests
}

// Friends have no friend request waiting between them.
fact NoFriendRequestBetweenFriends {
  no friendRequests & friend
}

// A block leaves no friendship and no friend request between the two.
fact BlockEndsFriendshipAndRequests {
  no (blocks + ~blocks) & (friend + friendRequests + ~friendRequests)
}

// A block goes one way: the blocked person cannot block the blocker back.
fact BlocksGoOneWay {
  no blocks & ~blocks
}

// A blocked person is nobody's friend on either side of the block.
assert BlockedPeopleAreNotFriends {
  all p, q: Person | q in p.blocks implies (q not in p.friend and p not in q.friend)
}
check BlockedPeopleAreNotFriends for 5

// Two people are friends, have a request waiting, have a block, or are strangers: never two of these.
assert OneTieAtATime {
  all p, q: Person {
    q in p.friend implies q not in p.(friendRequests + ~friendRequests + blocks + ~blocks)
    q in p.(friendRequests + ~friendRequests) implies q not in p.(blocks + ~blocks)
  }
}
check OneTieAtATime for 5

// The person asked is not the asker's friend while the friend request waits.
assert PersonAskedIsNotYetAFriend {
  all p, q: Person | q in p.friendRequests implies p not in q.friend
}
check PersonAskedIsNotYetAFriend for 5

// A world with a friendship, a waiting friend request and a block, among three people.
run { some friend and some friendRequests and some blocks } for 3 expect 1
