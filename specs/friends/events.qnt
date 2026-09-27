// What the Friends context tells everyone else about friendships.
//
// Two people became friends: one accepted the other's friend request. A
// friendship ended: one of them removed or blocked the other. The event does
// not say which, because a blocked person is never told they were blocked.
// Each event names the two people, in no order, since a friendship is
// mutual. These are facts already settled here; other contexts (the lobby in
// Spaces, which shows a friend's open space) react to them and never look
// inside friendship.qnt.
module events {
  type Person = str

  /// A fact about a friendship, already settled.
  type FriendshipEvent =
    | BecameFriends(Set[Person])
    | FriendshipEnded(Set[Person])
}
