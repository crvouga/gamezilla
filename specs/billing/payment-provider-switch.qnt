// Switching payment provider, and back.
//
// Alice and Bob are signed in, each with free access to start with. Plus
// payments are taken by two payment providers, the first and the second; the
// team decides which of them new memberships start at, and may switch
// payment provider (and switch back) at any time.
//
// Each person may subscribe when they have no live membership: a new
// membership starts on its free trial at the payment provider the team says
// new memberships start at. From then on that membership stays at the
// payment provider it started at, whatever the team switches to: its billing
// period ends there (a free trial becomes active, an active membership
// renews), it may be canceled immediately there, and its billing portal is
// there. Once it has ended the person may subscribe again, wherever new
// memberships start by then. What a person sees is always their newest
// membership (the one that counts) and the payment provider whose billing
// portal manages it.
//
// Subscribing and canceling need a connection. A billing period still ends,
// and the team can still switch payment provider, while a person is offline.
// Time at a payment provider passes for every membership there together.
// When one person's billing period ends, every membership there whose
// billing period is already due ends as well: a free trial becomes active,
// and an active membership renews. A membership at the other payment
// provider is left as it is.
module payment_provider_switch {
  type Person = str
  /// "first" | "second"
  type PaymentProvider = str
  /// "none" | "trialing" | "active" | "ended"
  type MembershipStatus = str

  pure val ALICE: Person = "alice"
  pure val BOB: Person = "bob"
  pure val PEOPLE: Set[Person] = Set(ALICE, BOB)

  pure val FIRST: PaymentProvider = "first"
  pure val SECOND: PaymentProvider = "second"
  pure val PAYMENT_PROVIDERS: Set[PaymentProvider] = Set(FIRST, SECOND)

  /// Checking machinery: how far back a change told again may reach; 0 is the
  /// latest.
  pure val HOW_FAR_BACK: Set[int] = 0.to(3)

  /// Checking machinery: a free trial is 7 days and a paid billing period is
  /// 30 days, so a free trial is shorter than the month already running.
  pure val TRIAL_DAYS: int = 7
  pure val MONTH_DAYS: int = 30

  /// Where new memberships start: the team's choice.
  var newMembershipsAt: PaymentProvider
  /// Each person's membership that counts (their newest): its status, or
  /// "none" before they ever subscribed.
  var membershipStatus: Person -> MembershipStatus
  /// The payment provider whose billing portal manages each person's
  /// membership that counts, or "none" before they ever subscribed.
  var billingPortalAt: Person -> str

  /// Each person's newest membership at each payment provider ("none" if
  /// they never had one there).
  var _membershipAt: PaymentProvider -> (Person -> MembershipStatus)
  /// Every piece of news each payment provider has told about each person,
  /// numbered from 0, oldest first.
  var _news: PaymentProvider -> (Person -> (int -> MembershipStatus))
  /// People whose device has no connection.
  var _offline: Set[Person]
  /// How many times each person has subscribed or canceled, and how many
  /// when their connection went.
  var _done: Person -> int
  var _doneAtCutOff: Person -> int
  /// How many days have passed at each payment provider.
  var _clock: PaymentProvider -> int
  /// The day each person's billing period is due at each payment provider,
  /// or 0 when they have none there.
  var _periodEnd: PaymentProvider -> (Person -> int)

  def _acted(person: Person): Person -> int =
    _done.set(person, _done.get(person) + 1)

  pure def isLive(s: MembershipStatus): bool = s == "trialing" or s == "active"

  pure def _other(provider: PaymentProvider): PaymentProvider =
    if (provider == FIRST) SECOND else FIRST

  pure def _count(log: int -> MembershipStatus): int = log.keys().size()

  /// A live membership at `provider` whose billing period is due by `target`.
  def _due(provider: PaymentProvider, target: int, person: Person): bool =
    billingPortalAt.get(person) == provider
    and isLive(membershipStatus.get(person))
    and _periodEnd.get(provider).get(person) <= target

  /// Every change goes through here: the payment provider `provider` changes
  /// `person`'s newest membership there to `status` and tells its news.
  action _change(
    provider: PaymentProvider,
    person: Person,
    status: MembershipStatus,
    newDone: Person -> int,
    newClock: PaymentProvider -> int,
    newPeriodEnd: PaymentProvider -> (Person -> int),
  ): bool = {
    val log = _news.get(provider).get(person)
    all {
      _membershipAt' = _membershipAt.setBy(provider, byPerson => byPerson.set(person, status)),
      _news' = _news.setBy(provider, byPerson => byPerson.set(person, log.put(_count(log), status))),
      membershipStatus' = membershipStatus.set(person, status),
      billingPortalAt' = billingPortalAt.set(person, provider),
      newMembershipsAt' = newMembershipsAt,
      _offline' = _offline,
      _done' = newDone,
      _doneAtCutOff' = _doneAtCutOff,
      _clock' = newClock,
      _periodEnd' = newPeriodEnd,
    }
  }

  action init = all {
    newMembershipsAt' = FIRST,
    membershipStatus' = PEOPLE.mapBy(_ => "none"),
    billingPortalAt' = PEOPLE.mapBy(_ => "none"),
    _membershipAt' = PAYMENT_PROVIDERS.mapBy(_ => PEOPLE.mapBy(_ => "none")),
    _news' = PAYMENT_PROVIDERS.mapBy(_ => PEOPLE.mapBy(_ => Map())),
    _offline' = Set(),
    _done' = PEOPLE.mapBy(_ => 0),
    _doneAtCutOff' = PEOPLE.mapBy(_ => 0),
    _clock' = PAYMENT_PROVIDERS.mapBy(_ => 0),
    _periodEnd' = PAYMENT_PROVIDERS.mapBy(_ => PEOPLE.mapBy(_ => 0)),
  }

  /// With no live membership: a free trial at the payment provider new
  /// memberships start at. It is due 7 days from the time there now.
  action subscribe(person: Person): bool = all {
    not(_offline.contains(person)),
    not(isLive(membershipStatus.get(person))),
    _change(
      newMembershipsAt,
      person,
      "trialing",
      _acted(person),
      _clock,
      _periodEnd.setBy(newMembershipsAt, ends =>
        ends.set(person, _clock.get(newMembershipsAt) + TRIAL_DAYS)
      ),
    ),
  }

  /// Time passes at one payment provider until `target`. Every live
  /// membership there that is already due ends its billing period.
  action _endDuePeriods(provider: PaymentProvider, target: int): bool = all {
    membershipStatus' = PEOPLE.mapBy(p =>
      if (_due(provider, target, p)) "active" else membershipStatus.get(p)
    ),
    billingPortalAt' = billingPortalAt,
    newMembershipsAt' = newMembershipsAt,
    _membershipAt' = _membershipAt.set(provider, PEOPLE.mapBy(p =>
      if (_due(provider, target, p)) "active" else _membershipAt.get(provider).get(p)
    )),
    _news' = _news.set(provider, PEOPLE.mapBy(p =>
      if (_due(provider, target, p))
        _news.get(provider).get(p).put(_count(_news.get(provider).get(p)), "active")
      else
        _news.get(provider).get(p)
    )),
    _offline' = _offline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
    _clock' = _clock.set(provider, target),
    _periodEnd' = _periodEnd.set(provider, PEOPLE.mapBy(p =>
      if (_due(provider, target, p))
        _periodEnd.get(provider).get(p) + MONTH_DAYS
      else
        _periodEnd.get(provider).get(p)
    )),
  }

  /// Time passes at the payment provider holding this live membership, until
  /// its billing period is due. Every membership there that is already due
  /// ends its billing period too.
  action periodEnd(person: Person): bool = all {
    isLive(membershipStatus.get(person)),
    _endDuePeriods(
      billingPortalAt.get(person),
      _periodEnd.get(billingPortalAt.get(person)).get(person),
    ),
  }

  /// The live membership ends at once, at the payment provider holding it.
  action cancelImmediately(person: Person): bool = all {
    not(_offline.contains(person)),
    isLive(membershipStatus.get(person)),
    _change(billingPortalAt.get(person), person, "ended", _acted(person), _clock, _periodEnd),
  }

  /// The team switches which payment provider new memberships start at.
  action switchPaymentProvider = all {
    newMembershipsAt' = _other(newMembershipsAt),
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
    _offline' = _offline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
    _clock' = _clock,
    _periodEnd' = _periodEnd,
  }

  /// Checking machinery: a payment provider tells the product again of an
  /// earlier change to a person's membership there, `back` changes before its
  /// latest, however late. Nothing changes for anyone, and it never changes a
  /// membership at the other payment provider.
  action _providerRepeatsNews(provider: PaymentProvider, person: Person, back: int): bool = all {
    back < _count(_news.get(provider).get(person)),
    newMembershipsAt' = newMembershipsAt,
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
    _offline' = _offline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
    _clock' = _clock,
    _periodEnd' = _periodEnd,
  }

  /// `person`'s device loses its connection.
  action _loseConnection(person: Person): bool = all {
    not(_offline.contains(person)),
    newMembershipsAt' = newMembershipsAt,
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
    _offline' = _offline.union(Set(person)),
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff.set(person, _done.get(person)),
    _clock' = _clock,
    _periodEnd' = _periodEnd,
  }

  /// Every connection comes back.
  action _connectionReturns: bool = all {
    _offline != Set(),
    newMembershipsAt' = newMembershipsAt,
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
    _offline' = Set(),
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
    _clock' = _clock,
    _periodEnd' = _periodEnd,
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet provider = PAYMENT_PROVIDERS.oneOf()
    nondet back = HOW_FAR_BACK.oneOf()
    any {
      subscribe(person),
      periodEnd(person),
      cancelImmediately(person),
      switchPaymentProvider,
      _providerRepeatsNews(provider, person, back),
      any { _loseConnection(person), _connectionReturns },
    }
  }

  /// Nobody has two live memberships, across both payment providers.
  val invOneLiveMembership = PEOPLE.forall(p =>
    PAYMENT_PROVIDERS.filter(pp => isLive(_membershipAt.get(pp).get(p))).size() <= 1
  )

  /// The membership that counts is the one at the payment provider whose
  /// billing portal manages it; a live membership is always the one that
  /// counts, so nothing at the other payment provider ever hides it.
  val invMembershipThatCountsIsAtItsBillingPortal = PEOPLE.forall(p =>
    if (billingPortalAt.get(p) == "none")
      membershipStatus.get(p) == "none"
    else
      membershipStatus.get(p) == _membershipAt.get(billingPortalAt.get(p)).get(p)
      and PAYMENT_PROVIDERS.forall(pp =>
        pp == billingPortalAt.get(p) or not(isLive(_membershipAt.get(pp).get(p)))
      )
  )

  /// Checking machinery: the last change each payment provider told the
  /// product about a person is how their membership there stands.
  val invLatestNewsIsTheMembership = PAYMENT_PROVIDERS.forall(pp => PEOPLE.forall(p => {
    val log = _news.get(pp).get(p)
    if (_count(log) == 0)
      _membershipAt.get(pp).get(p) == "none"
    else
      _membershipAt.get(pp).get(p) == log.get(_count(log) - 1)
  }))

  /// A person has a billing portal exactly once they have subscribed.
  val invBillingPortalOnceSubscribed = PEOPLE.forall(p =>
    (membershipStatus.get(p) == "none") iff (billingPortalAt.get(p) == "none")
  )

  /// New memberships start at one of the two payment providers.
  val invNewMembershipsAtAProvider = PAYMENT_PROVIDERS.contains(newMembershipsAt)

  /// With no connection, a person subscribes and cancels no further time.
  /// A billing period can still end.
  val invOfflineDoesNoMore = PEOPLE.forall(p =>
    _offline.contains(p) implies _done.get(p) == _doneAtCutOff.get(p)
  )

  /// A live membership's billing period is still ahead of the time at its
  /// payment provider. Ending one never leaves a due period behind.
  val invLivePeriodStillAhead = PAYMENT_PROVIDERS.forall(pp => PEOPLE.forall(p =>
    not(isLive(_membershipAt.get(pp).get(p)))
    or _periodEnd.get(pp).get(p) > _clock.get(pp)
  ))
}
