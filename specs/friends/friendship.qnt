// Becoming friends, and no longer.
//
// Alice, Bob and Carol are signed in. Anyone can look up someone they can
// find and ask them to be friends; while the request waits, the one who asked
// sees it as requested and can withdraw it, and the one asked finds it in
// their inbox, where they can accept or turn it down, or do the same from the
// asker's profile. Accepting makes both friends; either can later remove the
// other. Once turned down, the asker cannot ask that person again for a day:
// the request is refused and nothing reaches the other person.
//
// A person can block a friend, or someone who asked them, from that person's
// profile: the friendship ends, or the request goes away, and the blocked person
// can no longer find the one who blocked them. The one who blocked can still
// find them and unblock, after which either can ask again.
//
// What each person sees of each other person is one of: nothing between them
// (they can ask), friends, a request they sent, a request they received, a
// block they placed, or nobody (that person blocked them).
module friendship {
  type Person = str

  /// Three signed-in people.
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// What a person sees of another.
  type Tie =
    | Unrelated
    | Friends
    | Requested
    | Asked
    | Blocking
    | Hidden

  /// What each person sees of each other person.
  var sees: Person -> (Person -> Tie)

  /// Pairs of friends.
  var friends: Set[Set[Person]]
  /// Waiting requests, (from, to).
  var pending: Set[(Person, Person)]
  /// Blocks, (blocker, blocked).
  var blocks: Set[(Person, Person)]
  /// Requests turned down today, (from, to): asking again is refused.
  var declined: Set[(Person, Person)]

  pure def others(p: Person): Set[Person] = PEOPLE.exclude(Set(p))

  pure def tie(
    friends: Set[Set[Person]],
    pending: Set[(Person, Person)],
    blocks: Set[(Person, Person)],
    p: Person,
    q: Person,
  ): Tie =
    if (blocks.contains((p, q))) Blocking
    else if (blocks.contains((q, p))) Hidden
    else if (friends.contains(Set(p, q))) Friends
    else if (pending.contains((p, q))) Requested
    else if (pending.contains((q, p))) Asked
    else Unrelated

  action update(
    newFriends: Set[Set[Person]],
    newPending: Set[(Person, Person)],
    newBlocks: Set[(Person, Person)],
    newDeclined: Set[(Person, Person)],
  ): bool = all {
    friends' = newFriends,
    pending' = newPending,
    blocks' = newBlocks,
    declined' = newDeclined,
    sees' = PEOPLE.mapBy(p =>
      others(p).mapBy(q => tie(newFriends, newPending, newBlocks, p, q))
    ),
  }

  action init = update(Set(), Set(), Set(), Set())

  pure def between(pending: Set[(Person, Person)], a: Person, b: Person): Set[(Person, Person)] =
    pending.filter(r => r == (a, b) or r == (b, a))

  pure def seen(sees: Person -> (Person -> Tie), p: Person, q: Person): Tie =
    if (p == q) Unrelated else sees.get(p).get(q)

  /// Look someone up and ask them. Refused, with nothing sent, when they
  /// turned this person down today.
  action ask(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Unrelated,
    if (declined.contains((person, other)))
      update(friends, pending, blocks, declined)
    else
      update(friends, pending.union(Set((person, other))), blocks, declined),
  }

  /// Withdraw a request one sent.
  action cancel(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Requested,
    update(friends, pending.exclude(Set((person, other))), blocks, declined),
  }

  pure def accepted(friends: Set[Set[Person]], a: Person, b: Person): Set[Set[Person]] =
    friends.union(Set(Set(a, b)))

  /// Accept a request from the inbox.
  action accept(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Asked,
    update(accepted(friends, person, other), pending.exclude(Set((other, person))), blocks, declined),
  }

  /// Confirm a request from the asker's profile.
  action confirm(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Asked,
    update(accepted(friends, person, other), pending.exclude(Set((other, person))), blocks, declined),
  }

  /// Turn a request down from the inbox.
  action decline(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Asked,
    update(friends, pending.exclude(Set((other, person))), blocks, declined.union(Set((other, person)))),
  }

  /// Turn a request down from the asker's profile.
  action turnDown(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Asked,
    update(friends, pending.exclude(Set((other, person))), blocks, declined.union(Set((other, person)))),
  }

  /// Remove a friend.
  action remove(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Friends,
    update(friends.exclude(Set(Set(person, other))), pending, blocks, declined),
  }

  /// Block a friend, or someone who asked, from their profile: their
  /// friendship, or the waiting request, ends.
  action block(person: Person, other: Person): bool = all {
    person != other,
    Set(Friends, Asked).contains(seen(sees, person, other)),
    update(
      friends.exclude(Set(Set(person, other))),
      pending.exclude(between(pending, person, other)),
      blocks.union(Set((person, other))),
      declined,
    ),
  }

  /// Unblock someone one blocked.
  action unblock(person: Person, other: Person): bool = all {
    person != other,
    seen(sees, person, other) == Blocking,
    update(friends, pending, blocks.exclude(Set((person, other))), declined),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    any {
      ask(person, other),
      cancel(person, other),
      accept(person, other),
      confirm(person, other),
      decline(person, other),
      turnDown(person, other),
      remove(person, other),
      block(person, other),
      unblock(person, other),
    }
  }

  /// Friendship is mutual.
  val invFriendsBothWays = PEOPLE.forall(p => others(p).forall(q =>
    (seen(sees, p, q) == Friends) == (seen(sees, q, p) == Friends)
  ))

  /// A sent request is a received one on the other side.
  val invRequestsPair = PEOPLE.forall(p => others(p).forall(q =>
    (seen(sees, p, q) == Requested) == (seen(sees, q, p) == Asked)
  ))

  /// The person blocked cannot find the one who blocked them.
  val invBlockedCannotFind = PEOPLE.forall(p => others(p).forall(q =>
    (seen(sees, p, q) == Blocking) == (seen(sees, q, p) == Hidden)
  ))

  /// Nobody is friends with, or waiting on, someone a block stands between.
  val invBlockEndsTies = blocks.forall(b =>
    not(friends.contains(Set(b._1, b._2))) and between(pending, b._1, b._2) == Set()
  )
}
