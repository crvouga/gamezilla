// Signing in with a sign-in link sent to an email address.
//
// Two people, each with a device and an email address of their own: Chris
// uses the phone and reads the mailbox of Chris's email address; Uma uses the
// laptop and reads the mailbox of Uma's. Nobody reads anyone else's mailbox.
// This environment has a way to send mail.
//
// On a device that is not signed in, either of them can ask for a sign-in
// link at either email address. The sign-in link arrives in that email
// address's mailbox, whoever asked for it. The person who reads that mailbox
// can open it on their device, which signs that device into the account that
// belongs to the email address. The first sign-in link opened for an email
// address starts its account; every later one gets into that same account. A
// sign-in link works once, and lapses 10 minutes after it was asked for;
// opening one that no longer works signs nobody in. A signed-in person can
// sign out, and get back in with a new sign-in link.
//
// A device can lose its connection. Asking for a sign-in link and opening one
// then change nothing, and the device stays signed in, or signed out, as it
// was. Signing out works with or without a connection.
module sign_in_links {
  type Device = str
  type EmailAddress = str
  type SignInLink = int

  pure val DEVICES: Set[Device] = Set("phone", "laptop")
  pure val EMAIL_ADDRESSES: Set[EmailAddress] = Set("chris", "uma")
  /// Bookkeeping: the most sign-in links one walk asks for.
  pure val MAX_SIGN_IN_LINKS: int = 4

  /// Whose mailbox the person at each device reads: their own, and nobody
  /// else's.
  pure def readsMailbox(device: Device, emailAddress: EmailAddress): bool =
    (device == "phone" and emailAddress == "chris") or (device == "laptop" and emailAddress == "uma")

  /// The account each signed-in device is signed into (accounts numbered in
  /// the order they started). A device not signed in is not listed.
  var signedInto: Device -> int
  /// The account that belongs to each email address (0: none yet).
  var accountAt: EmailAddress -> int
  /// How many accounts there are.
  var accountCount: int
  /// The sign-in links that have arrived in each email address's mailbox
  /// (numbered in the order they were asked for).
  var mailbox: EmailAddress -> Set[SignInLink]
  /// The devices that have lost their connection.
  var offline: Set[Device]

  /// The sign-in links that still work: not opened yet, and not lapsed.
  var _working: Set[SignInLink]
  /// The sign-in links that have signed someone in.
  var _opened: Set[SignInLink]
  /// How many sign-in links have been asked for.
  var _linkCount: int

  action _unchanged: bool = all {
    signedInto' = signedInto,
    accountAt' = accountAt,
    accountCount' = accountCount,
    mailbox' = mailbox,
    offline' = offline,
    _working' = _working,
    _opened' = _opened,
    _linkCount' = _linkCount,
  }

  action init = all {
    signedInto' = Map(),
    accountAt' = EMAIL_ADDRESSES.mapBy(e => 0),
    accountCount' = 0,
    mailbox' = EMAIL_ADDRESSES.mapBy(e => Set()),
    offline' = Set(),
    _working' = Set(),
    _opened' = Set(),
    _linkCount' = 0,
  }

  /// On a device that is not signed in, ask for a sign-in link at an email
  /// address. It arrives in that email address's mailbox.
  action askForSignInLink(device: Device, emailAddress: EmailAddress): bool = {
    val asked = _linkCount + 1
    all {
      not(signedInto.keys().contains(device)),
      _linkCount < MAX_SIGN_IN_LINKS,
      if (offline.contains(device)) _unchanged
      else all {
        signedInto' = signedInto,
        accountAt' = accountAt,
        accountCount' = accountCount,
        mailbox' = mailbox.set(emailAddress, mailbox.get(emailAddress).union(Set(asked))),
        offline' = offline,
        _working' = _working.union(Set(asked)),
        _opened' = _opened,
        _linkCount' = asked,
      },
    }
  }

  /// On a device that is not signed in, open a sign-in link from the mailbox
  /// it arrived in. Only the person who reads that mailbox can.
  action openSignInLink(device: Device, emailAddress: EmailAddress, signInLink: SignInLink): bool = {
    val belonging = accountAt.get(emailAddress)
    val account = if (belonging != 0) belonging else accountCount + 1
    all {
      readsMailbox(device, emailAddress),
      mailbox.get(emailAddress).contains(signInLink),
      not(signedInto.keys().contains(device)),
      if (offline.contains(device) or not(_working.contains(signInLink))) _unchanged
      else all {
        signedInto' = signedInto.put(device, account),
        accountAt' = accountAt.set(emailAddress, account),
        accountCount' = (if (belonging != 0) accountCount else accountCount + 1),
        mailbox' = mailbox,
        offline' = offline,
        _working' = _working.exclude(Set(signInLink)),
        _opened' = _opened.union(Set(signInLink)),
        _linkCount' = _linkCount,
      },
    }
  }

  /// Sign out on a signed-in device, with or without a connection.
  action signOut(device: Device): bool = all {
    signedInto.keys().contains(device),
    signedInto' = signedInto.keys().exclude(Set(device)).mapBy(d => signedInto.get(d)),
    accountAt' = accountAt,
    accountCount' = accountCount,
    mailbox' = mailbox,
    offline' = offline,
    _working' = _working,
    _opened' = _opened,
    _linkCount' = _linkCount,
  }

  /// 11 minutes pass: every sign-in link asked for so far lapses. Nobody sees
  /// this on its own: a person finds out when they open one.
  action signInLinksLapse: bool = all {
    _working != Set(),
    signedInto' = signedInto,
    accountAt' = accountAt,
    accountCount' = accountCount,
    mailbox' = mailbox,
    offline' = offline,
    _working' = Set(),
    _opened' = _opened,
    _linkCount' = _linkCount,
  }

  /// The device goes offline. Nobody sees this on its own: it shows only in
  /// what the device can then do.
  action loseConnection(device: Device): bool = all {
    not(offline.contains(device)),
    signedInto' = signedInto,
    accountAt' = accountAt,
    accountCount' = accountCount,
    mailbox' = mailbox,
    offline' = offline.union(Set(device)),
    _working' = _working,
    _opened' = _opened,
    _linkCount' = _linkCount,
  }

  /// The device is back online. Nobody sees this on its own either.
  action connectionReturns(device: Device): bool = all {
    offline.contains(device),
    signedInto' = signedInto,
    accountAt' = accountAt,
    accountCount' = accountCount,
    mailbox' = mailbox,
    offline' = offline.exclude(Set(device)),
    _working' = _working,
    _opened' = _opened,
    _linkCount' = _linkCount,
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet emailAddress = EMAIL_ADDRESSES.oneOf()
    nondet signInLink = 1.to(MAX_SIGN_IN_LINKS).oneOf()
    any {
      askForSignInLink(device, emailAddress),
      openSignInLink(device, emailAddress, signInLink),
      openSignInLink(device, emailAddress, signInLink),
      signOut(device),
      signInLinksLapse,
      any { loseConnection(device), connectionReturns(device) },
    }
  }

  /// One account belongs to each email address that has one, and no two
  /// email addresses share an account.
  val invOneAccountForEachEmailAddress = EMAIL_ADDRESSES.forall(e => and {
    accountAt.get(e) >= 0,
    accountAt.get(e) <= accountCount,
    EMAIL_ADDRESSES.forall(f => (e != f and accountAt.get(e) != 0) implies (accountAt.get(e) != accountAt.get(f))),
  })

  /// A device is signed into an account only when its person reads the
  /// mailbox of the email address that account belongs to.
  val invOnlyMailboxReadersGetIn = signedInto.keys().forall(d =>
    EMAIL_ADDRESSES.exists(e => readsMailbox(d, e) and accountAt.get(e) != 0 and accountAt.get(e) == signedInto.get(d))
  )

  /// A sign-in link that has signed someone in no longer works.
  val invSignInLinksWorkOnce = _opened.intersect(_working) == Set()

  /// Bookkeeping: a sign-in link arrives in one mailbox only, the mailbox of
  /// the email address it was asked for at.
  val invEachSignInLinkInOneMailbox = EMAIL_ADDRESSES.forall(e =>
    EMAIL_ADDRESSES.forall(f => (e != f) implies (mailbox.get(e).intersect(mailbox.get(f)) == Set()))
  )

  /// Bookkeeping: a device with no connection is signed into a real account,
  /// or into none.
  val invOfflineSignedIntoARealAccount = DEVICES.forall(d =>
    (offline.contains(d) and signedInto.keys().contains(d)) implies
      (signedInto.get(d) >= 1 and signedInto.get(d) <= accountCount)
  )
}
