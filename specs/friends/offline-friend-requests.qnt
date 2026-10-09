// Alice and Bob are signed in; Alice already has Bob's profile on her device.
// Bob keeps his connection throughout this account.
// Alice can ask while offline under the relationships she knows. The request
// shows for her and survives reopening, but reaches Bob only after she returns.
// A block made while she is away can refuse the choice without revealing that
// Bob blocked her. Undoing the block before she returns allows it to be shared.
module offline_friend_requests {
  type Person = str
  pure val PEOPLE = Set("alice", "bob")
  type _Facts = {
    local: bool, shared: bool, queued: bool, refused: bool,
    blocked: bool, declined: bool,
    knownDeclined: bool, knownBlocked: bool,
  }
  var _facts: _Facts
  var _offline: Set[Person]
  /// The request each person can see: sent by Alice, received by Bob.
  var requestShown: Person -> bool
  /// Alice is told that her accepted request will be shared when she returns.
  var waitingToShare: bool
  /// Alice is told that her request was refused, with no block revealed.
  var requestRefused: bool

  action _keep(after) = all {
    _facts' = { local: after.local, shared: after.shared, queued: after.queued,
      refused: after.refused, blocked: after.blocked,
      declined: after.declined, knownDeclined: after.knownDeclined,
      knownBlocked: after.knownBlocked },
    requestShown' = Map("alice" -> after.local, "bob" -> after.shared),
    waitingToShare' = after.queued,
    requestRefused' = after.refused,
  }

  action init = all {
    _offline' = Set(),
    _keep({ local: false, shared: false, queued: false, refused: false,
      blocked: false, declined: false, knownDeclined: false, knownBlocked: false }),
  }

  /// Alice asks from the profile already on her device; a known recent decline refuses it.
  action ask: bool = all {
    _offline' = _offline,
    not(_facts.local), not(_facts.knownBlocked),
    if (_facts.knownDeclined)
      _keep({ ..._facts, refused: true })
    else _keep({ ..._facts, local: true, shared: not(_offline.contains("alice")),
      queued: _offline.contains("alice"), refused: false }),
  }

  /// Bob declines a request already shared with him.
  action decline: bool = all {
    _offline' = _offline,
    _facts.shared,
    _keep({ ..._facts, shared: false, declined: true,
      local: if (_offline.contains("alice")) _facts.local else false,
      knownDeclined: if (_offline.contains("alice")) _facts.knownDeclined else true }),
  }

  /// Bob blocks Alice while she is away; the unshared choice stays on Alice's device.
  action blockPerson: bool = all {
    _offline' = _offline,
    _offline.contains("alice"), not(_facts.blocked),
    _keep({ ..._facts, blocked: true, shared: false }),
  }

  /// Bob undoes his block before Alice returns.
  action unblockPerson: bool = all {
    _offline' = _offline,
    _offline.contains("alice"), _facts.blocked,
    _keep({ ..._facts, blocked: false }),
  }

  /// Alice loses her connection without losing the relationships she knows.
  action _loseConnection(person: Person): bool = all {
    person == "alice", not(_offline.contains(person)),
    _offline' = _offline.union(Set(person)),
    _keep(_facts),
  }

  /// Alice returns: her accepted request is shared or clearly refused.
  action _connectionReturns: bool = {
    val refused = _facts.queued and (_facts.blocked or _facts.declined)
    val shared = if (_facts.queued) not(refused) else _facts.shared
    all {
      _offline.contains("alice"),
      _offline' = Set(),
      _keep({ ..._facts, queued: false, local: shared, shared: shared,
        refused: if (_facts.queued) refused else _facts.refused,
        knownDeclined: _facts.declined, knownBlocked: _facts.blocked }),
    }
  }

  /// Alice closes and reopens her app; her accepted choice or refusal is kept.
  action reopen: bool = all { _offline' = _offline, _keep(_facts) }

  action step = {
    nondet person = PEOPLE.oneOf()
    any { ask, decline, blockPerson, unblockPerson,
      _loseConnection(person), _connectionReturns, reopen }
  }

  /// A request accepted offline remains private to the asker until shared.
  val invPendingRequestIsPrivate = waitingToShare implies
    _offline.contains("alice") and requestShown.get("alice") and not(requestShown.get("bob"))
  /// With the connection restored, both people see the same shared request.
  val invSharedRequestAgrees = not(_offline.contains("alice")) implies
    requestShown.get("alice") == requestShown.get("bob")
  /// A block leaves no request in the blocker's inbox.
  val invBlockEndsSharedRequest = _facts.blocked implies not(requestShown.get("bob"))
  /// A refusal is clear and is never described as waiting to be shared.
  val invRefusalEndsPendingChoice = requestRefused implies
    not(waitingToShare) and not(requestShown.get("alice"))
  /// An accepted offline choice remains visible on the asker's device.
  val invOwnChoiceIsKept = _offline.contains("alice") and _facts.queued implies requestShown.get("alice")

  val _inductive = all {
    _offline.subseteq(Set("alice")),
    requestShown == Map("alice" -> _facts.local, "bob" -> _facts.shared),
    waitingToShare == _facts.queued,
    requestRefused == _facts.refused,
    not(_offline.contains("alice")) implies
      _facts.knownDeclined == _facts.declined and _facts.knownBlocked == _facts.blocked,
    _facts.shared implies not(_facts.blocked) and not(_facts.declined),
    invPendingRequestIsPrivate, invSharedRequestAgrees, invBlockEndsSharedRequest,
    invRefusalEndsPendingChoice, invOwnChoiceIsKept,
  }
}
