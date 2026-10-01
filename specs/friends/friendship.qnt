// Becoming friends, and no longer.
//
// Alice, Bob and Carol are signed in. Anyone can look up someone they can
// find and ask them to be friends; while the friend request waits, the asker
// sees it as sent and can cancel it, and the person asked finds it in their
// inbox, where they can accept or decline it, or do the same from the
// asker's profile. Accepting starts a friendship; either friend can later
// remove the other. Once declined, the asker cannot ask that person again
// for a day: the ask is refused and nothing reaches the other person.
//
// A person can block a friend, or someone who asked them, from that person's
// profile: the friendship ends, or the friend request goes away, and the
// blocked person can no longer find the blocker. The blocker can still find
// them and unblock, after which they are strangers and either can ask again.
//
// Each person's friendship status with each other person is one of: a
// stranger (they can ask), a friend, a friend request they sent, one they
// received, someone they blocked, or hidden (that person blocked them).
//
// Asking, canceling, accepting, declining, removing, blocking and unblocking
// all need a connection. What the other person does still shows.
module friendship {
  type Person = str

  /// Three signed-in people.
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// Where a person stands with another, as they see it.
  type FriendshipStatus =
    | Stranger
    | Friend
    | RequestSent
    | RequestReceived
    | Blocking
    | Hidden

  /// Each person's friendship status with each other person.
  var friendshipStatus: Person -> (Person -> FriendshipStatus)

  /// Friendships, each a pair of friends.
  var friendships: Set[Set[Person]]
  /// Waiting friend requests, (asker, person asked).
  var friendRequests: Set[(Person, Person)]
  /// Blocks, (blocker, blocked person).
  var blocks: Set[(Person, Person)]
  /// Friend requests declined today, (asker, person asked): asking again is refused.
  var declined: Set[(Person, Person)]
  /// People whose device has no connection.
  var _offline: Set[Person]
  /// How many times each person has asked, answered, removed or blocked, and
  /// how many when their connection went.
  var _done: Person -> int
  var _doneAtCutOff: Person -> int

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  pure def _others(p: Person): Set[Person] = PEOPLE.exclude(Set(p))

  pure def _status(
    friends: Set[Set[Person]],
    pending: Set[(Person, Person)],
    blocks: Set[(Person, Person)],
    p: Person,
    q: Person,
  ): FriendshipStatus =
    if (blocks.contains((p, q))) Blocking
    else if (blocks.contains((q, p))) Hidden
    else if (friends.contains(Set(p, q))) Friend
    else if (pending.contains((p, q))) RequestSent
    else if (pending.contains((q, p))) RequestReceived
    else Stranger

  action _update(
    newFriends: Set[Set[Person]],
    newPending: Set[(Person, Person)],
    newBlocks: Set[(Person, Person)],
    newDeclined: Set[(Person, Person)],
    newOffline: Set[Person],
    newDone: Person -> int,
    newCutOff: Person -> int,
  ): bool = all {
    friendships' = newFriends,
    friendRequests' = newPending,
    blocks' = newBlocks,
    declined' = newDeclined,
    friendshipStatus' = PEOPLE.mapBy(p =>
      _others(p).mapBy(q => _status(newFriends, newPending, newBlocks, p, q))
    ),
    _offline' = newOffline,
    _done' = newDone,
    _doneAtCutOff' = newCutOff,
  }

  action init = _update(
    Set(), Set(), Set(), Set(), Set(), PEOPLE.mapBy(_ => 0), PEOPLE.mapBy(_ => 0),
  )

  pure def _between(pending: Set[(Person, Person)], a: Person, b: Person): Set[(Person, Person)] =
    pending.filter(r => r == (a, b) or r == (b, a))

  pure def _seen(sees: Person -> (Person -> FriendshipStatus), p: Person, q: Person): FriendshipStatus =
    if (p == q) Stranger else sees.get(p).get(q)

  /// Look someone up and ask them. Refused, with nothing sent, when they
  /// declined this person today.
  action ask(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == Stranger,
    if (declined.contains((person, other)))
      _update(friendships, friendRequests, blocks, declined, _offline, _acted(person), _doneAtCutOff)
    else
      _update(
        friendships, friendRequests.union(Set((person, other))), blocks, declined,
        _offline, _acted(person), _doneAtCutOff,
      ),
  }

  /// Cancel a friend request one sent.
  action cancel(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == RequestSent,
    _update(
      friendships, friendRequests.exclude(Set((person, other))), blocks, declined,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  pure def _accepted(friends: Set[Set[Person]], a: Person, b: Person): Set[Set[Person]] =
    friends.union(Set(Set(a, b)))

  /// Accept a friend request from the inbox.
  action accept(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == RequestReceived,
    _update(
      _accepted(friendships, person, other), friendRequests.exclude(Set((other, person))), blocks, declined,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Accept a friend request from the asker's profile.
  action acceptFromProfile(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == RequestReceived,
    _update(
      _accepted(friendships, person, other), friendRequests.exclude(Set((other, person))), blocks, declined,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Decline a friend request from the inbox.
  action decline(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == RequestReceived,
    _update(
      friendships, friendRequests.exclude(Set((other, person))), blocks, declined.union(Set((other, person))),
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Decline a friend request from the asker's profile.
  action declineFromProfile(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == RequestReceived,
    _update(
      friendships, friendRequests.exclude(Set((other, person))), blocks, declined.union(Set((other, person))),
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Remove a friend.
  action remove(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == Friend,
    _update(
      friendships.exclude(Set(Set(person, other))), friendRequests, blocks, declined,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// Block someone from their profile or request: any
  /// friendship, or the waiting friend request, ends.
  action block(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    Set(Stranger, Friend, RequestSent, RequestReceived).contains(_seen(friendshipStatus, person, other)),
    _update(
      friendships.exclude(Set(Set(person, other))),
      friendRequests.exclude(_between(friendRequests, person, other)),
      blocks.union(Set((person, other))),
      declined,
      _offline,
      _acted(person),
      _doneAtCutOff,
    ),
  }

  /// Unblock someone one blocked.
  action unblock(person: Person, other: Person): bool = all {
    not(_offline.contains(person)),
    person != other,
    _seen(friendshipStatus, person, other) == Blocking,
    _update(
      friendships, friendRequests, blocks.exclude(Set((person, other))), declined,
      _offline, _acted(person), _doneAtCutOff,
    ),
  }

  /// `person`'s device loses its connection.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    _update(
      friendships, friendRequests, blocks, declined, _offline.union(Set(person)), _done,
      _doneAtCutOff.set(person, _done.get(person)),
    ),
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _update(friendships, friendRequests, blocks, declined, Set(), _done, _doneAtCutOff),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.exclude(Set(person)).oneOf()
    any {
      ask(person, other),
      cancel(person, other),
      accept(person, other),
      acceptFromProfile(person, other),
      decline(person, other),
      declineFromProfile(person, other),
      remove(person, other),
      block(person, other),
      unblock(person, other),
      any { _loseConnection(person), _connectionReturns },
    }
  }

  /// Friendship is mutual.
  val invFriendsBothWays = PEOPLE.forall(p => _others(p).forall(q =>
    (_seen(friendshipStatus, p, q) == Friend) == (_seen(friendshipStatus, q, p) == Friend)
  ))

  /// A friend request sent is one received on the other side.
  val invRequestsPair = PEOPLE.forall(p => _others(p).forall(q =>
    (_seen(friendshipStatus, p, q) == RequestSent) == (_seen(friendshipStatus, q, p) == RequestReceived)
  ))

  /// The blocked person cannot find the blocker.
  val invBlockedCannotFind = PEOPLE.forall(p => _others(p).forall(q =>
    (_seen(friendshipStatus, p, q) == Blocking) == (_seen(friendshipStatus, q, p) == Hidden)
  ))

  /// A block leaves no friendship and no friend request between the two.
  val invBlockEndsTies = blocks.forall(b =>
    not(friendships.contains(Set(b._1, b._2))) and _between(friendRequests, b._1, b._2) == Set()
  )

  /// A friend request declined today is not still waiting.
  val invDeclinedIsNotWaiting = declined.forall(d => not(friendRequests.contains(d)))

  /// With no connection, a person asks, answers, removes and blocks no
  /// further time. What someone else does still shows.
  val invOfflineDoesNoMore = PEOPLE.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )
}
