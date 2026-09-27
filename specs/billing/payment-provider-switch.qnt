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
// memberships start by then.
//
// Each payment provider tells the product its news about each person's
// memberships there, and may repeat any piece of that news later, however
// late and however often. Hearing it again changes nothing: what a person
// sees is always their newest membership (the one that counts) and the
// payment provider whose billing portal manages it.
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

  /// How far back a repeated piece of news may reach: 0 is the latest.
  pure val HOW_FAR_BACK: Set[int] = 0.to(3)

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

  pure def isLive(s: MembershipStatus): bool = s == "trialing" or s == "active"

  pure def _other(provider: PaymentProvider): PaymentProvider =
    if (provider == FIRST) SECOND else FIRST

  pure def _count(log: int -> MembershipStatus): int = log.keys().size()

  /// Every change goes through here: the payment provider `provider` changes
  /// `person`'s newest membership there to `status` and tells its news.
  action _change(provider: PaymentProvider, person: Person, status: MembershipStatus): bool = {
    val log = _news.get(provider).get(person)
    all {
      _membershipAt' = _membershipAt.setBy(provider, byPerson => byPerson.set(person, status)),
      _news' = _news.setBy(provider, byPerson => byPerson.set(person, log.put(_count(log), status))),
      membershipStatus' = membershipStatus.set(person, status),
      billingPortalAt' = billingPortalAt.set(person, provider),
      newMembershipsAt' = newMembershipsAt,
    }
  }

  action init = all {
    newMembershipsAt' = FIRST,
    membershipStatus' = PEOPLE.mapBy(_ => "none"),
    billingPortalAt' = PEOPLE.mapBy(_ => "none"),
    _membershipAt' = PAYMENT_PROVIDERS.mapBy(_ => PEOPLE.mapBy(_ => "none")),
    _news' = PAYMENT_PROVIDERS.mapBy(_ => PEOPLE.mapBy(_ => Map())),
  }

  /// With no live membership: a free trial at the payment provider new
  /// memberships start at.
  action subscribe(person: Person): bool = all {
    not(isLive(membershipStatus.get(person))),
    _change(newMembershipsAt, person, "trialing"),
  }

  /// The billing period ends at the payment provider holding the live
  /// membership: a free trial becomes active, an active membership renews.
  action periodEnd(person: Person): bool = all {
    isLive(membershipStatus.get(person)),
    _change(billingPortalAt.get(person), person, "active"),
  }

  /// The live membership ends at once, at the payment provider holding it.
  action cancelImmediately(person: Person): bool = all {
    isLive(membershipStatus.get(person)),
    _change(billingPortalAt.get(person), person, "ended"),
  }

  /// The team switches which payment provider new memberships start at.
  action switchPaymentProvider = all {
    newMembershipsAt' = _other(newMembershipsAt),
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
  }

  /// A payment provider repeats a piece of its earlier news about a person,
  /// `back` pieces before its latest: nothing changes.
  action providerRepeatsNews(provider: PaymentProvider, person: Person, back: int): bool = all {
    back < _count(_news.get(provider).get(person)),
    newMembershipsAt' = newMembershipsAt,
    membershipStatus' = membershipStatus,
    billingPortalAt' = billingPortalAt,
    _membershipAt' = _membershipAt,
    _news' = _news,
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
      providerRepeatsNews(provider, person, back),
    }
  }

  /// Nobody has two live memberships, across both payment providers.
  val invOneLiveMembership = PEOPLE.forall(p =>
    PAYMENT_PROVIDERS.filter(pp => isLive(_membershipAt.get(pp).get(p))).size() <= 1
  )

  /// The membership that counts is the one at the payment provider whose
  /// billing portal manages it; a live membership is always the one that
  /// counts, so news from the other payment provider never changes it.
  val invMembershipThatCountsIsAtItsBillingPortal = PEOPLE.forall(p =>
    if (billingPortalAt.get(p) == "none")
      membershipStatus.get(p) == "none"
    else
      membershipStatus.get(p) == _membershipAt.get(billingPortalAt.get(p)).get(p)
      and PAYMENT_PROVIDERS.forall(pp =>
        pp == billingPortalAt.get(p) or not(isLive(_membershipAt.get(pp).get(p)))
      )
  )

  /// Each payment provider's latest news about a person is how their
  /// membership there stands.
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
}
