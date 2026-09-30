// Which account each outside account gets people into, whatever people,
// devices, Google and Apple do.
//
// Three shared devices (a phone, a laptop and a tablet), and five outside
// accounts: Chris's Google account and Chris's Apple account share one
// verified email address; Uma's Google account and Uma's Apple account share
// one email address that Google has not verified; Dan's Apple account shares
// its address with nobody.
//
// On a device that is not signed in, anyone can sign in with any outside
// account. An outside account that already gets into an account signs in to
// it. A new one whose email address a matching account already has becomes
// one of its sign-in methods at once when both email addresses are verified; otherwise the person is
// asked to confirm the matching account, and then either confirms it (by
// signing in with one of its outside accounts; any other fails) or keeps the
// accounts separate (a new account). Any other new outside account starts a
// new account.
//
// Signed in, a person can connect a sign-in method (not an outside account
// of another account, and not a second one from the same provider;
// connecting starts a new sign-in there in place of the old one), remove
// one (never the last), sign out (online, that sign-in is over everywhere it
// is held; offline, only this device forgets it) or sign out everywhere.
// Someone can steal a device's sign-in onto another device; the stolen
// sign-in gets into the same account for as long as that sign-in lasts.
//
// A device can go offline: signing in, confirming, connecting, removing and
// signing out everywhere then change nothing. Google or Apple can be having
// trouble: nothing that needs it changes anything until it recovers. At
// Apple, a person can stop using Sign in with Apple (every device of the
// account it gets into is signed out) or delete their Apple account (it is
// no longer a sign-in method and never signs in again; an account left with
// no sign-in method is signed out everywhere). The chance to confirm a
// matching account lapses after 10 minutes; every sign-in lapses after 30
// days.
module outside_accounts {
  type Device = str
  type OutsideAccount = str
  type Provider = str

  pure val DEVICES: Set[Device] = Set("phone", "laptop", "tablet")
  pure val OUTSIDE_ACCOUNTS: Set[OutsideAccount] =
    Set("googleChris", "appleChris", "googleUma", "appleUma", "appleDan")
  pure val APPLE_ACCOUNTS: Set[OutsideAccount] = Set("appleChris", "appleUma", "appleDan")
  pure val PROVIDERS: Set[Provider] = Set("google", "apple")

  pure def providerOf(o: OutsideAccount): Provider =
    if (APPLE_ACCOUNTS.contains(o)) "apple" else "google"

  pure def sameEmailAddress(o: OutsideAccount, p: OutsideAccount): bool =
    Set(o, p) == Set("googleChris", "appleChris") or Set(o, p) == Set("googleUma", "appleUma")

  pure def verifiedEmailAddress(o: OutsideAccount): bool =
    Set("googleChris", "appleChris", "appleUma", "appleDan").contains(o)

  /// The account each signed-in device is signed into (accounts numbered in
  /// the order they started). A device not signed in is not listed.
  var signedInto: Device -> int
  /// Every account's sign-in methods: the outside accounts that get into it.
  var signInMethods: int -> Set[OutsideAccount]
  /// How many accounts there are.
  var accountCount: int
  /// The devices whose person is being asked to confirm a matching account.
  var askedToConfirm: Set[Device]
  /// The devices that have lost their connection.
  var offline: Set[Device]

  /// The sign-in each device holds (numbered), live or not.
  var _held: Device -> int
  /// Every live sign-in, and the account it gets into.
  var _live: int -> int
  var _signInCount: int
  /// A matching account waiting to be confirmed on each device: the new
  /// outside account, the matching account, and whether the chance to
  /// confirm has lapsed.
  var _proofs: Device -> { parked: OutsideAccount, target: int, lapsed: bool }
  /// What is going on at Google and Apple: which provider is having trouble,
  /// which Apple accounts are deleted, and which stopped using Sign in with
  /// Apple.
  var _outside: { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] }

  pure def _without(m: a -> b, k: a): a -> b =
    m.keys().exclude(Set(k)).mapBy(x => m.get(x))

  /// No two different things in `s`.
  pure def _atMostOne(s: Set[t]): bool = s.forall(x => s.forall(y => x == y))

  /// The account an outside account gets into (0: none).
  pure def ownerOf(methods: int -> Set[OutsideAccount], o: OutsideAccount): int =
    methods.keys().fold(0, (found, a) => if (methods.get(a).contains(o)) a else found)

  /// The matching account for a new outside account (0: none).
  pure def _partnerOf(o: OutsideAccount): OutsideAccount =
    OUTSIDE_ACCOUNTS.filter(p => sameEmailAddress(o, p)).fold(o, (found, p) => p)

  pure def matchingAccount(methods: int -> Set[OutsideAccount], o: OutsideAccount): int = {
    val p = _partnerOf(o)
    val owner = ownerOf(methods, p)
    if (p != o and owner != 0 and methods.get(owner).forall(q => providerOf(q) != providerOf(o))) owner
    else 0
  }

  pure def _signedIn(held: Device -> int, live: int -> int, d: Device): bool =
    held.keys().contains(d) and live.keys().contains(held.get(d))

  pure def _usable(outside: { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] }, o: OutsideAccount): bool =
    not(outside.trouble.contains(providerOf(o))) and not(outside.deleted.contains(o))

  /// Every live sign-in into an account is over.
  pure def _endAll(live: int -> int, a: int): int -> int =
    live.keys().filter(n => live.get(n) != a).mapBy(n => live.get(n))

  action _update(
    held: Device -> int,
    live: int -> int,
    count: int,
    methods: int -> Set[OutsideAccount],
    accounts: int,
    proofs: Device -> { parked: OutsideAccount, target: int, lapsed: bool },
    outside: { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] },
    off: Set[Device],
  ): bool = all {
    _held' = held,
    _live' = live,
    _signInCount' = count,
    signInMethods' = methods,
    accountCount' = accounts,
    _proofs' = proofs,
    askedToConfirm' = proofs.keys(),
    _outside' = outside,
    offline' = off,
    signedInto' = held.keys().filter(d => live.keys().contains(held.get(d))).mapBy(d => live.get(held.get(d))),
  }

  action _unchanged: bool =
    _update(_held, _live, _signInCount, signInMethods, accountCount, _proofs, _outside, offline)

  /// The device starts a new sign-in into account a.
  action _startSignIn(
    device: Device,
    a: int,
    methods: int -> Set[OutsideAccount],
    accounts: int,
    proofs: Device -> { parked: OutsideAccount, target: int, lapsed: bool },
    outside: { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] },
  ): bool = {
    val n = _signInCount + 1
    _update(_held.put(device, n), _live.put(n, a), n, methods, accounts, proofs, outside, offline)
  }

  /// Signing in with an Apple account again lets the app use it again.
  pure def _allowed(outside: { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] }, o: OutsideAccount): { trouble: Set[Provider], deleted: Set[OutsideAccount], stopped: Set[OutsideAccount] } =
    outside.with("stopped", outside.stopped.exclude(Set(o)))

  action init = all {
    _held' = Map(),
    _live' = Map(),
    _signInCount' = 0,
    signInMethods' = Map(),
    accountCount' = 0,
    _proofs' = Map(),
    askedToConfirm' = Set(),
    _outside' = { trouble: Set(), deleted: Set(), stopped: Set() },
    offline' = Set(),
    signedInto' = Map(),
  }

  /// Sign in with an outside account on a device that is not signed in.
  action signIn(device: Device, outsideAccount: OutsideAccount): bool = {
    val owner = ownerOf(signInMethods, outsideAccount)
    val matched = matchingAccount(signInMethods, outsideAccount)
    val atOnce = verifiedEmailAddress(outsideAccount) and verifiedEmailAddress(_partnerOf(outsideAccount))
    val allowed = _allowed(_outside, outsideAccount)
    all {
      not(offline.contains(device)),
      not(_signedIn(_held, _live, device)),
      not(askedToConfirm.contains(device)),
      if (not(_usable(_outside, outsideAccount))) _unchanged
      else if (owner != 0) _startSignIn(device, owner, signInMethods, accountCount, _proofs, allowed)
      else if (matched != 0 and atOnce)
        _startSignIn(
          device,
          matched,
          signInMethods.set(matched, signInMethods.get(matched).union(Set(outsideAccount))),
          accountCount,
          _proofs,
          allowed,
        )
      else if (matched != 0)
        _update(
          _held, _live, _signInCount, signInMethods, accountCount,
          _proofs.put(device, { parked: outsideAccount, target: matched, lapsed: false }),
          _outside, offline,
        )
      else
        _startSignIn(
          device,
          accountCount + 1,
          signInMethods.put(accountCount + 1, Set(outsideAccount)),
          accountCount + 1,
          _proofs,
          allowed,
        ),
    }
  }

  /// Confirm the matching account the device is asked about, with an outside
  /// account.
  action confirmMatchingAccount(device: Device, outsideAccount: OutsideAccount): bool = {
    val proof = _proofs.get(device)
    val confirmer = ownerOf(signInMethods, outsideAccount)
    val parkedOwner = ownerOf(signInMethods, proof.parked)
    val rest = _without(_proofs, device)
    all {
      askedToConfirm.contains(device),
      not(offline.contains(device)),
      if (proof.lapsed)
        _update(_held, _live, _signInCount, signInMethods, accountCount, rest, _outside, offline)
      else if (not(_usable(_outside, outsideAccount))) _unchanged
      else if (confirmer != proof.target)
        _update(_held, _live, _signInCount, signInMethods, accountCount, rest, _outside, offline)
      else if (parkedOwner == proof.target)
        _startSignIn(device, proof.target, signInMethods, accountCount, rest, _allowed(_outside, outsideAccount))
      else if (parkedOwner != 0 or signInMethods.get(proof.target).exists(q => providerOf(q) == providerOf(proof.parked)))
        _update(_held, _live, _signInCount, signInMethods, accountCount, rest, _outside, offline)
      else
        _startSignIn(
          device,
          proof.target,
          signInMethods.set(proof.target, signInMethods.get(proof.target).union(Set(proof.parked))),
          accountCount,
          rest,
          _allowed(_outside, outsideAccount),
        ),
    }
  }

  /// Answer the matching account by starting a new account instead.
  action keepSeparate(device: Device): bool = {
    val proof = _proofs.get(device)
    val parkedOwner = ownerOf(signInMethods, proof.parked)
    val rest = _without(_proofs, device)
    all {
      askedToConfirm.contains(device),
      not(offline.contains(device)),
      if (proof.lapsed)
        _update(_held, _live, _signInCount, signInMethods, accountCount, rest, _outside, offline)
      else if (parkedOwner != 0)
        _startSignIn(device, parkedOwner, signInMethods, accountCount, rest, _outside)
      else
        _startSignIn(
          device,
          accountCount + 1,
          signInMethods.put(accountCount + 1, Set(proof.parked)),
          accountCount + 1,
          rest,
          _outside,
        ),
    }
  }

  /// Connect an outside account to the account the device is signed into.
  action connectSignInMethod(device: Device, outsideAccount: OutsideAccount): bool = {
    val a = _live.get(_held.get(device))
    val owner = ownerOf(signInMethods, outsideAccount)
    val swapped = _without(_live, _held.get(device))
    val n = _signInCount + 1
    val refused =
      or {
        owner != 0 and owner != a,
        owner == 0 and signInMethods.get(a).exists(q => providerOf(q) == providerOf(outsideAccount)),
      }
    all {
      _signedIn(_held, _live, device),
      if (offline.contains(device) or not(_usable(_outside, outsideAccount)) or refused) _unchanged
      else
        _update(
          _held.put(device, n),
          swapped.put(n, a),
          n,
          signInMethods.set(a, signInMethods.get(a).union(Set(outsideAccount))),
          accountCount,
          _proofs,
          _allowed(_outside, outsideAccount),
          offline,
        ),
    }
  }

  /// Remove the sign-in method from a provider from the device's account.
  action removeSignInMethod(device: Device, provider: Provider): bool = {
    val a = _live.get(_held.get(device))
    val methods = signInMethods.get(a)
    all {
      _signedIn(_held, _live, device),
      if (offline.contains(device) or _atMostOne(methods)) _unchanged
      else
        _update(
          _held, _live, _signInCount,
          signInMethods.set(a, methods.filter(q => providerOf(q) != provider)),
          accountCount, _proofs, _outside, offline,
        ),
    }
  }

  /// Sign out on a device that holds a sign-in.
  action signOut(device: Device): bool = all {
    _held.keys().contains(device),
    _update(
      _without(_held, device),
      if (offline.contains(device)) _live else _without(_live, _held.get(device)),
      _signInCount, signInMethods, accountCount, _proofs, _outside, offline,
    ),
  }

  /// Sign the device's account out on every device.
  action signOutEverywhere(device: Device): bool = all {
    _signedIn(_held, _live, device),
    if (offline.contains(device)) _unchanged
    else
      _update(
        _held, _endAll(_live, _live.get(_held.get(device))), _signInCount,
        signInMethods, accountCount, _proofs, _outside, offline,
      ),
  }

  /// Someone steals one device's sign-in onto another device.
  action stealSignIn(device: Device, other: Device): bool = all {
    device != other,
    _held.keys().contains(device),
    not(askedToConfirm.contains(other)),
    _update(
      _held.put(other, _held.get(device)),
      _live, _signInCount, signInMethods, accountCount, _proofs, _outside, offline,
    ),
  }

  /// The device goes offline. Nobody sees this on its own: it shows only in
  /// what the device can then do.
  action loseConnection(device: Device): bool = all {
    not(offline.contains(device)),
    _update(_held, _live, _signInCount, signInMethods, accountCount, _proofs, _outside, offline.union(Set(device))),
  }

  /// The device is back online. Nobody sees this on its own either.
  action connectionReturns(device: Device): bool = all {
    offline.contains(device),
    _update(_held, _live, _signInCount, signInMethods, accountCount, _proofs, _outside, offline.exclude(Set(device))),
  }

  /// Google or Apple starts having trouble. Nobody sees this on its own: it
  /// shows when someone next signs in, connects or confirms with it.
  action troubleStarts(provider: Provider): bool = all {
    not(_outside.trouble.contains(provider)),
    _update(
      _held, _live, _signInCount, signInMethods, accountCount, _proofs,
      _outside.with("trouble", _outside.trouble.union(Set(provider))),
      offline,
    ),
  }

  /// Google or Apple recovers; it shows when someone next signs in with it.
  action troubleEnds(provider: Provider): bool = all {
    _outside.trouble.contains(provider),
    _update(
      _held, _live, _signInCount, signInMethods, accountCount, _proofs,
      _outside.with("trouble", _outside.trouble.exclude(Set(provider))),
      offline,
    ),
  }

  /// At Apple, the holder of an Apple account stops letting the app use it.
  action stopUsingSignInWithApple(outsideAccount: OutsideAccount): bool = {
    val owner = ownerOf(signInMethods, outsideAccount)
    all {
      APPLE_ACCOUNTS.contains(outsideAccount),
      not(_outside.deleted.contains(outsideAccount)),
      not(_outside.stopped.contains(outsideAccount)),
      _update(
        _held,
        if (owner != 0) _endAll(_live, owner) else _live,
        _signInCount, signInMethods, accountCount, _proofs,
        _outside.with("stopped", _outside.stopped.union(Set(outsideAccount))),
        offline,
      ),
    }
  }

  /// At Apple, the holder deletes their Apple account for good.
  action deleteAppleAccount(outsideAccount: OutsideAccount): bool = {
    val owner = ownerOf(signInMethods, outsideAccount)
    val left = if (owner != 0) signInMethods.get(owner).exclude(Set(outsideAccount)) else Set()
    all {
      APPLE_ACCOUNTS.contains(outsideAccount),
      not(_outside.deleted.contains(outsideAccount)),
      // Apple tells the app only while the app may still use the account.
      not(owner != 0 and _outside.stopped.contains(outsideAccount)),
      _update(
        _held,
        if (owner != 0 and left == Set()) _endAll(_live, owner) else _live,
        _signInCount,
        if (owner != 0) signInMethods.set(owner, left) else signInMethods,
        accountCount, _proofs,
        _outside.with("deleted", _outside.deleted.union(Set(outsideAccount))),
        offline,
      ),
    }
  }

  /// 11 minutes pass: every chance to confirm a matching account lapses.
  /// Nobody sees this on its own: they are told when they next answer.
  action chanceToConfirmLapses: bool = all {
    askedToConfirm != Set(),
    _update(
      _held, _live, _signInCount, signInMethods, accountCount,
      _proofs.keys().mapBy(d => _proofs.get(d).with("lapsed", true)),
      _outside, offline,
    ),
  }

  /// 30 days pass: every sign-in lapses, and so does every chance to
  /// confirm a matching account.
  action signInsLapse: bool = all {
    _live.keys() != Set(),
    _update(
      _held, Map(), _signInCount, signInMethods, accountCount,
      _proofs.keys().mapBy(d => _proofs.get(d).with("lapsed", true)),
      _outside, offline,
    ),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet other = DEVICES.oneOf()
    nondet outsideAccount = OUTSIDE_ACCOUNTS.oneOf()
    nondet provider = PROVIDERS.oneOf()
    any {
      signIn(device, outsideAccount),
      signIn(device, outsideAccount),
      confirmMatchingAccount(device, outsideAccount),
      keepSeparate(device),
      connectSignInMethod(device, outsideAccount),
      removeSignInMethod(device, provider),
      any { signOut(device), signOutEverywhere(device) },
      stealSignIn(device, other),
      any { loseConnection(device), connectionReturns(device) },
      any { troubleStarts(provider), troubleEnds(provider) },
      any { stopUsingSignInWithApple(outsideAccount), deleteAppleAccount(outsideAccount) },
      any { chanceToConfirmLapses, signInsLapse },
    }
  }

  /// An account never has two outside accounts from one provider.
  val invOneOfEachProvider = signInMethods.keys().forall(a =>
    PROVIDERS.forall(p => _atMostOne(signInMethods.get(a).filter(q => providerOf(q) == p)))
  )

  /// An outside account gets into at most one account.
  val invOneAccountEach = OUTSIDE_ACCOUNTS.forall(o =>
    _atMostOne(signInMethods.keys().filter(a => signInMethods.get(a).contains(o)))
  )

  /// Devices are signed into accounts that exist, and that some sign-in
  /// method still gets into.
  val invSignedIntoReachableAccounts = signedInto.keys().forall(d => {
    val a = signedInto.get(d)
    a >= 1 and a <= accountCount and signInMethods.get(a) != Set()
  })

  /// A device is asked to confirm exactly while a matching account waits
  /// for its answer.
  val invAskedWhileAMatchWaits = askedToConfirm == _proofs.keys()

  /// A device with no connection is signed into a real account, or into none.
  val invOfflineSignedIntoARealAccount = DEVICES.forall(d =>
    offline.contains(d) and signedInto.keys().contains(d) implies
      signedInto.get(d) >= 1 and signedInto.get(d) <= accountCount
  )
}
