// The life of one person's Plus membership.
//
// Alice is signed in on her computer ("alice") and on her phone
// ("alice-phone"), both looking at the billing plans. She starts on the free
// plan and subscribes from the plans screen: a monthly trial. From then on the
// payment provider moves her membership along: a billing period ends (a trial
// becomes active, an active membership renews), her card starts being declined
// (the next renewal leaves the membership delinquent) and later a working card
// pays, or the provider gives up after the last retry (it ends); she cancels at
// the period end and changes her mind, cancels right away, or switches between
// the monthly and the yearly plan. The provider may deliver the same news
// twice. Once a membership has ended she can check out again, which starts a
// new monthly trial beside the old one.
//
// Switching plans after the trial starts a paid period on the new plan at
// once, less a credit for the unused part of the old one; credit beyond the
// new plan's price stays on her account and pays later renewals first, so a
// declined card only matters once the credit no longer covers a renewal.
//
// The server keeps every membership the provider told it about; each signed-in
// device holds its own copy and shows paid or free from it. Her phone can lose
// the connection: it then keeps the copy it had, and once back it holds the
// server's again.
//
// Paid access lasts through a delinquent or ended membership's grace period
// (7 days past its period end). Billing time runs on the provider's clock, not
// the devices', so every membership that ever started is still within grace
// here: a device with any membership shows paid.
module membership_lifecycle {
  type Device = str

  pure val COMPUTER: Device = "alice"
  pure val PHONE: Device = "alice-phone"
  pure val DEVICES: Set[Device] = Set(COMPUTER, PHONE)

  /// "trialing" | "active" | "delinquent" | "ended"
  type Status = str
  /// "month" | "year"
  type Interval = str

  /// Plus's price per period, in cents.
  pure val PRICE: Interval -> int = Map("month" -> 700, "year" -> 6000)

  type Membership = {
    status: Status,
    interval: Interval,
    cancelAtPeriodEnd: bool,
  }

  /// Every membership the server holds for Alice, numbered from 0, oldest
  /// first.
  var memberships: int -> Membership
  /// The memberships her phone holds.
  var phoneMemberships: int -> Membership
  /// Whether her phone reaches the server.
  var phoneOnline: bool
  /// What each device shows: "paid" or "free".
  var tier: Device -> str
  /// Bookkeeping at the provider: the credit on her account, in cents.
  var credit: int
  /// Bookkeeping at the provider: whether her card on file is declined.
  var cardDeclines: bool

  pure def count(ms: int -> Membership): int = ms.keys().size()

  pure def tierOf(held: int -> Membership): str =
    if (count(held) > 0) "paid" else "free"

  pure def isLive(m: Membership): bool =
    m.status == "trialing" or m.status == "active"

  def newest: Membership = memberships.get(count(memberships) - 1)

  pure def replaceNewest(ms: int -> Membership, m: Membership): int -> Membership =
    ms.set(count(ms) - 1, m)

  pure def max(a: int, b: int): int = if (a > b) a else b

  /// Every step goes through here: the server's memberships become `rows`,
  /// and the phone keeps up while it is online. (Period ends are left out:
  /// that an online device holds the server's rows to the last column is a
  /// standing property the product is checked against after every step.)
  action moveTo(
    rows: int -> Membership,
    online: bool,
    newCredit: int,
    declines: bool,
  ): bool = {
    val held = if (online) rows else phoneMemberships
    all {
      memberships' = rows,
      phoneOnline' = online,
      phoneMemberships' = held,
      tier' = DEVICES.mapBy(d => if (d == PHONE) tierOf(held) else tierOf(rows)),
      credit' = newCredit,
      cardDeclines' = declines,
    }
  }

  /// The provider changes the newest membership; nothing is billed.
  action providerChanges(m: Membership): bool =
    moveTo(replaceNewest(memberships, m), phoneOnline, credit, cardDeclines)

  /// The newest membership starts a period billed `amount` cents: credit pays
  /// first, the card the rest. Paid → active, declined → delinquent.
  action bill(m: Membership, amount: int, declines: bool): bool = {
    val due = max(0, amount - credit)
    val status = if (due == 0 or not(declines)) "active" else "delinquent"
    moveTo(
      replaceNewest(memberships, { ...m, status: status }),
      phoneOnline,
      max(0, credit - amount),
      declines,
    )
  }

  action init = all {
    memberships' = Map(),
    phoneMemberships' = Map(),
    phoneOnline' = true,
    tier' = DEVICES.mapBy(_ => "free"),
    credit' = 0,
    cardDeclines' = false,
  }

  /// From the plans screen on her computer, the first time, with a working
  /// card.
  action subscribe = all {
    count(memberships) == 0,
    moveTo(
      Map(0 -> { status: "trialing", interval: "month", cancelAtPeriodEnd: false }),
      phoneOnline,
      credit,
      false,
    ),
  }

  /// The period ends at the card on file: a membership set to cancel ends;
  /// otherwise the next period is billed.
  action renew(declines: bool): bool = all {
    count(memberships) > 0,
    isLive(newest),
    if (newest.cancelAtPeriodEnd)
      moveTo(
        replaceNewest(memberships, { ...newest, status: "ended", cancelAtPeriodEnd: false }),
        phoneOnline,
        credit,
        declines,
      )
    else
      bill(newest, PRICE.get(newest.interval), declines),
  }

  /// The billing period ends: a trial turns active, an active membership
  /// renews; one set to cancel at the period end ends instead.
  action periodEnd = renew(cardDeclines)

  /// Her card starts being declined, and the period ends.
  action paymentFailed = renew(true)

  /// A working card pays the declined renewal.
  action paymentRecovered = all {
    count(memberships) > 0,
    newest.status == "delinquent",
    moveTo(
      replaceNewest(memberships, { ...newest, status: "active" }),
      phoneOnline,
      credit,
      false,
    ),
  }

  /// The provider gives up after the last retry.
  action paymentRetriesExhausted = all {
    count(memberships) > 0,
    newest.status == "delinquent",
    providerChanges({ ...newest, status: "ended" }),
  }

  action cancelAtPeriodEnd = all {
    count(memberships) > 0,
    isLive(newest),
    not(newest.cancelAtPeriodEnd),
    providerChanges({ ...newest, cancelAtPeriodEnd: true }),
  }

  action resume = all {
    count(memberships) > 0,
    isLive(newest),
    newest.cancelAtPeriodEnd,
    providerChanges({ ...newest, cancelAtPeriodEnd: false }),
  }

  /// Ends the membership at once.
  action cancelNow = all {
    count(memberships) > 0,
    newest.status != "ended",
    providerChanges({ ...newest, status: "ended", cancelAtPeriodEnd: false }),
  }

  /// Monthly to yearly or back. A trial carries on on the new plan; an active
  /// membership starts a paid period on it right away, less the whole old
  /// period as credit (billing always stands at the start of a period here:
  /// every step that moves the provider's clock starts one).
  action switchInterval = {
    val other = if (newest.interval == "month") "year" else "month"
    all {
      count(memberships) > 0,
      isLive(newest),
      if (newest.status == "trialing")
        providerChanges({ ...newest, interval: other })
      else {
        val net = PRICE.get(other) - PRICE.get(newest.interval)
        val due = max(0, net - credit)
        moveTo(
          replaceNewest(memberships, {
            ...newest,
            interval: other,
            status: if (due == 0 or not(cardDeclines)) "active" else "delinquent",
          }),
          phoneOnline,
          max(0, credit - net),
          cardDeclines,
        )
      },
    }
  }

  /// The provider sends its last membership update again: nothing changes.
  action redeliverLastEvent = all {
    count(memberships) > 0,
    moveTo(memberships, phoneOnline, credit, cardDeclines),
  }

  /// Checking out again at the provider, with a working card, after the
  /// membership ended.
  action resubscribe = all {
    count(memberships) > 0,
    newest.status == "ended",
    moveTo(
      memberships.put(count(memberships), { status: "trialing", interval: "month", cancelAtPeriodEnd: false }),
      phoneOnline,
      credit,
      false,
    ),
  }

  action secondDeviceOffline = all {
    phoneOnline,
    moveTo(memberships, false, credit, cardDeclines),
  }

  action secondDeviceOnline = all {
    not(phoneOnline),
    moveTo(memberships, true, credit, cardDeclines),
  }

  /// What happens around the membership rather than to it, drawn as one
  /// choice so a trace spends most of its steps moving the membership.
  action plumbing = any {
    redeliverLastEvent,
    secondDeviceOffline,
    secondDeviceOnline,
  }

  action step = any {
    subscribe,
    periodEnd,
    paymentFailed,
    paymentRecovered,
    paymentRetriesExhausted,
    cancelAtPeriodEnd,
    resume,
    cancelNow,
    switchInterval,
    resubscribe,
    plumbing,
  }

  /// Only the newest membership may still be going.
  val invOnlyNewestNotEnded = memberships.keys().forall(i =>
    i == count(memberships) - 1 or memberships.get(i).status == "ended"
  )

  /// An ended membership is never still set to cancel.
  val invEndedNotCanceling = memberships.keys().forall(i =>
    memberships.get(i).status != "ended" or not(memberships.get(i).cancelAtPeriodEnd)
  )

  /// A phone that reaches the server holds what the server holds.
  val invOnlinePhoneInSync = phoneOnline implies phoneMemberships == memberships

  /// Once subscribed, Alice's computer shows paid.
  val invSubscribedIsPaid = count(memberships) > 0 implies tier.get(COMPUTER) == "paid"

  /// Credit never goes negative.
  val invCreditNotNegative = credit >= 0
}
