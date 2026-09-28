// The life of one person's Plus membership.
//
// Alice is signed in on her computer ("alice") and on her phone
// ("alice-phone"), both looking at the billing plans. She starts with free
// access and subscribes from the billing plans: a monthly free trial. From then
// on the payment provider moves her membership along: a billing period ends (a
// free trial becomes active, an active membership renews), her card starts
// being declined (the next renewal leaves the membership delinquent) and later
// a working card pays, or the payment provider gives up on the payment (it
// ends); she cancels in the billing portal and renews it there again, cancels
// immediately, or switches between the monthly and the yearly plan. Once a
// membership has ended she can subscribe again, which starts a new monthly
// free trial beside the old one.
//
// Switching Plus plans after the free trial starts a paid billing period on
// the new plan at once, less credit for the unused part of the old one; credit
// beyond the new plan's price stays hers and pays later renewals first, so a
// declined card only matters once the credit no longer covers a renewal.
//
// Each device she is signed in on shows her memberships and paid or free
// access. Her phone can lose its connection: it then still shows what it
// showed, and once back online it shows what her computer shows again.
//
// Paid access lasts through a delinquent or ended membership's grace (7 days
// past its period end). Grace never runs out here, so a device that shows any
// membership shows paid access.
module membership_lifecycle {
  type Device = str

  pure val COMPUTER: Device = "alice"
  pure val PHONE: Device = "alice-phone"
  pure val DEVICES: Set[Device] = Set(COMPUTER, PHONE)

  /// "trialing" | "active" | "delinquent" | "ended"
  type MembershipStatus = str
  /// "month" | "year"
  type Plan = str

  /// Plus's price per period, in cents.
  pure val PRICE: Plan -> int = Map("month" -> 700, "year" -> 6000)

  type Membership = {
    status: MembershipStatus,
    plan: Plan,
    endsAtPeriodEnd: bool,
  }

  /// Every membership Alice has had, numbered from 0, oldest first, as her
  /// computer knows them.
  var memberships: int -> Membership
  /// The memberships her phone knows of.
  var membershipsOnPhone: int -> Membership
  /// Whether her phone has a connection.
  var _phoneOnline: bool
  /// The access each device shows her: "paid" or "free".
  var accessOn: Device -> str
  /// Her credit, in cents.
  var credit: int
  /// Whether her card is declined.
  var cardDeclines: bool

  pure def _count(ms: int -> Membership): int = ms.keys().size()

  pure def _accessFrom(held: int -> Membership): str =
    if (_count(held) > 0) "paid" else "free"

  pure def isLive(m: Membership): bool =
    m.status == "trialing" or m.status == "active"

  def _newest: Membership = memberships.get(_count(memberships) - 1)

  pure def _replaceNewest(ms: int -> Membership, m: Membership): int -> Membership =
    ms.set(_count(ms) - 1, m)

  pure def _max(a: int, b: int): int = if (a > b) a else b

  /// Every step goes through here: her memberships become `rows`, and the
  /// phone keeps up while it has a connection. (Period ends are left out:
  /// that a connected device knows every detail of every membership is a
  /// standing property the product is checked against after every step.)
  action _moveTo(
    rows: int -> Membership,
    online: bool,
    newCredit: int,
    declines: bool,
  ): bool = {
    val held = if (online) rows else membershipsOnPhone
    all {
      memberships' = rows,
      _phoneOnline' = online,
      membershipsOnPhone' = held,
      accessOn' = DEVICES.mapBy(d => if (d == PHONE) _accessFrom(held) else _accessFrom(rows)),
      credit' = newCredit,
      cardDeclines' = declines,
    }
  }

  /// The payment provider changes the newest membership; nothing is charged.
  action _changeNewest(m: Membership): bool =
    _moveTo(_replaceNewest(memberships, m), _phoneOnline, credit, cardDeclines)

  /// The newest membership starts a billing period charged `amount` cents:
  /// credit pays first, the card the rest. Paid → active, declined →
  /// delinquent.
  action _bill(m: Membership, amount: int, declines: bool): bool = {
    val due = _max(0, amount - credit)
    val status = if (due == 0 or not(declines)) "active" else "delinquent"
    _moveTo(
      _replaceNewest(memberships, { ...m, status: status }),
      _phoneOnline,
      _max(0, credit - amount),
      declines,
    )
  }

  action init = all {
    memberships' = Map(),
    membershipsOnPhone' = Map(),
    _phoneOnline' = true,
    accessOn' = DEVICES.mapBy(_ => "free"),
    credit' = 0,
    cardDeclines' = false,
  }

  /// From the billing plans on her computer, the first time, with a working
  /// card.
  action subscribe = all {
    _count(memberships) == 0,
    _moveTo(
      Map(0 -> { status: "trialing", plan: "month", endsAtPeriodEnd: false }),
      _phoneOnline,
      credit,
      false,
    ),
  }

  /// The renewal at the period end, on a card that is declined or not: a
  /// membership set to end at the period end ends; otherwise the next billing
  /// period is charged.
  action renew(declines: bool): bool = all {
    _count(memberships) > 0,
    isLive(_newest),
    if (_newest.endsAtPeriodEnd)
      _moveTo(
        _replaceNewest(memberships, { ..._newest, status: "ended", endsAtPeriodEnd: false }),
        _phoneOnline,
        credit,
        declines,
      )
    else
      _bill(_newest, PRICE.get(_newest.plan), declines),
  }

  /// The billing period ends: a free trial turns active, an active
  /// membership renews; one set to end at the period end ends instead.
  action periodEnd = renew(cardDeclines)

  /// Her card starts being declined, and the billing period ends.
  action paymentFailed = renew(true)

  /// A working card pays the declined renewal.
  action paymentRecovered = all {
    _count(memberships) > 0,
    _newest.status == "delinquent",
    _moveTo(
      _replaceNewest(memberships, { ..._newest, status: "active" }),
      _phoneOnline,
      credit,
      false,
    ),
  }

  /// The payment provider gives up on the failed payment.
  action paymentRetriesExhausted = all {
    _count(memberships) > 0,
    _newest.status == "delinquent",
    _changeNewest({ ..._newest, status: "ended" }),
  }

  /// In the billing portal: set to end at the period end.
  action cancel = all {
    _count(memberships) > 0,
    isLive(_newest),
    not(_newest.endsAtPeriodEnd),
    _changeNewest({ ..._newest, endsAtPeriodEnd: true }),
  }

  /// In the billing portal, before the period end: taking back a cancel.
  action renewInBillingPortal = all {
    _count(memberships) > 0,
    isLive(_newest),
    _newest.endsAtPeriodEnd,
    _changeNewest({ ..._newest, endsAtPeriodEnd: false }),
  }

  /// Ends the membership at once.
  action cancelImmediately = all {
    _count(memberships) > 0,
    _newest.status != "ended",
    _changeNewest({ ..._newest, status: "ended", endsAtPeriodEnd: false }),
  }

  /// Monthly plan to yearly plan or back, in the billing portal. A free trial
  /// carries on on the new plan; an active membership starts a paid billing
  /// period on it right away, less the whole old period as credit (billing
  /// always stands at the start of a period here: every step that moves the
  /// payment provider's clock starts one).
  action switchPlan = {
    val other = if (_newest.plan == "month") "year" else "month"
    all {
      _count(memberships) > 0,
      isLive(_newest),
      if (_newest.status == "trialing")
        _changeNewest({ ..._newest, plan: other })
      else {
        val net = PRICE.get(other) - PRICE.get(_newest.plan)
        val due = _max(0, net - credit)
        _moveTo(
          _replaceNewest(memberships, {
            ..._newest,
            plan: other,
            status: if (due == 0 or not(cardDeclines)) "active" else "delinquent",
          }),
          _phoneOnline,
          _max(0, credit - net),
          cardDeclines,
        )
      },
    }
  }

  /// Checking machinery: the payment provider tells the product its last
  /// change to the membership again. Nothing changes for Alice.
  action _providerRepeatsNews = all {
    _count(memberships) > 0,
    _moveTo(memberships, _phoneOnline, credit, cardDeclines),
  }

  /// Subscribing again at checkout, with a working card, after the membership
  /// ended.
  action resubscribe = all {
    _count(memberships) > 0,
    _newest.status == "ended",
    _moveTo(
      memberships.put(_count(memberships), { status: "trialing", plan: "month", endsAtPeriodEnd: false }),
      _phoneOnline,
      credit,
      false,
    ),
  }

  /// Her phone loses its connection.
  action _phoneGoesOffline = all {
    _phoneOnline,
    _moveTo(memberships, false, credit, cardDeclines),
  }

  /// Her phone is back online.
  action _phoneBackOnline = all {
    not(_phoneOnline),
    _moveTo(memberships, true, credit, cardDeclines),
  }

  /// What happens around the membership rather than to it, drawn as one
  /// choice so a trace spends most of its steps moving the membership.
  action _aroundTheMembership = any {
    _providerRepeatsNews,
    _phoneGoesOffline,
    _phoneBackOnline,
  }

  action step = any {
    subscribe,
    periodEnd,
    paymentFailed,
    paymentRecovered,
    paymentRetriesExhausted,
    cancel,
    renewInBillingPortal,
    cancelImmediately,
    switchPlan,
    resubscribe,
    _aroundTheMembership,
  }

  /// Only the newest membership may still be going.
  val invOnlyNewestNotEnded = memberships.keys().forall(i =>
    i == _count(memberships) - 1 or memberships.get(i).status == "ended"
  )

  /// An ended membership is never still set to end at the period end.
  val invEndedNotCanceling = memberships.keys().forall(i =>
    memberships.get(i).status != "ended" or not(memberships.get(i).endsAtPeriodEnd)
  )

  /// A phone with a connection knows what her computer knows.
  val invOnlinePhoneInSync = _phoneOnline implies membershipsOnPhone == memberships

  /// Once subscribed, Alice's computer shows paid access.
  val invSubscribedIsPaid = _count(memberships) > 0 implies accessOn.get(COMPUTER) == "paid"

  /// Credit never goes negative.
  val invCreditNotNegative = credit >= 0
}
