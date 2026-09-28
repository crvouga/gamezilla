// Signing in to an account, on two devices.
//
// Alice uses two devices (called "alice" and "bob" here; the second is her
// other device, where her account is signed in too). She has three outside
// accounts: her Google account, an Apple account at the same verified Gmail
// address (she shares it with the app), and an iCloud Apple account whose
// address she hides.
//
// On a device that is not signed in she can sign in with any of them. An
// outside account that already signs into an account signs in to it; a new
// one that is an address match for an account (the other outside account at
// that verified address signs into it, and it has no sign-in method from the
// same company yet) joins that account; any other new one starts a new
// account. Signed in and online, she can connect the sign-in method her
// account is missing (an outside account that already signs into another
// account is refused), remove one of two sign-in methods (the last one always
// stays), sign out, or sign out everywhere. A device can lose its connection:
// she can still sign out there, a sign-in she starts there fails when she
// abandons it, and it still shows the sign-in methods it last saw until the
// connection comes back. Signing out everywhere signs the account out on
// every device at once; a device that is offline shows it once it is back
// online.
module account_sign_in {
  type Device = str
  type SignInMethod = str
  type OutsideAccount = str

  pure val DEVICES: Set[Device] = Set("alice", "bob")

  /// Alice's outside accounts.
  pure val OUTSIDE_ACCOUNTS: Set[OutsideAccount] = Set("google", "appleShared", "appleHidden")

  pure val SIGN_IN_METHODS: Set[SignInMethod] = Set("google", "apple")

  /// The most accounts Alice can have: every account keeps one of her three
  /// outside accounts, and each outside account signs into one account.
  pure val MAX_ACCOUNTS: int = 3

  /// The accounts that exist, when `accountCount` of them have been started.
  pure def _accounts(accountCount: int): Set[int] =
    1.to(MAX_ACCOUNTS).filter(a => a <= accountCount)

  pure def signInMethodOf(i: OutsideAccount): SignInMethod =
    if (i == "google") "google" else "apple"

  /// The Google account and the Gmail Apple account share one verified
  /// address; the hidden iCloud address matches nothing.
  pure def sameAddress(i: OutsideAccount, j: OutsideAccount): bool =
    i != j and Set(i, j) == Set("google", "appleShared")

  /// The account (numbered in the order they were started) each device is
  /// signed in to, as everyone else knows it. A device not signed in is not
  /// listed.
  var account: Device -> int
  /// Every account's sign-in methods, as everyone else knows them.
  var signInMethods: int -> Set[SignInMethod]
  /// The sign-in methods each signed-in device shows (what it last saw).
  var signInMethodsShown: Device -> Set[SignInMethod]

  /// The account each outside account signs into (0: none).
  var signsInto: OutsideAccount -> int
  /// How many accounts exist.
  var accountCount: int
  /// The devices that have lost their connection.
  var offline: Set[Device]
  /// The devices that show they are signed in (an offline device has not yet
  /// heard that its account signed out everywhere).
  var showsSignedIn: Set[Device]

  pure def _signInMethodsOf(signsInto: OutsideAccount -> int, accountCount: int): int -> Set[SignInMethod] =
    _accounts(accountCount).mapBy(a => OUTSIDE_ACCOUNTS.filter(i => signsInto.get(i) == a).map(signInMethodOf))

  /// Online devices show what everyone else knows; offline ones what they last saw.
  pure def _mirror(
    prev: Device -> Set[SignInMethod],
    account: Device -> int,
    offline: Set[Device],
    signInMethods: int -> Set[SignInMethod],
  ): Device -> Set[SignInMethod] =
    account.keys().mapBy(d =>
      if (offline.contains(d) and prev.keys().contains(d)) prev.get(d)
      else signInMethods.get(account.get(d))
    )

  action _update(
    newAccount: Device -> int,
    newOwner: OutsideAccount -> int,
    newCreated: int,
    newOffline: Set[Device],
    newLooks: Set[Device],
  ): bool = {
    val newMethods = _signInMethodsOf(newOwner, newCreated)
    all {
      account' = newAccount,
      signsInto' = newOwner,
      accountCount' = newCreated,
      offline' = newOffline,
      showsSignedIn' = newLooks,
      signInMethods' = newMethods,
      signInMethodsShown' = _mirror(signInMethodsShown, newAccount, newOffline, newMethods),
    }
  }

  action init = all {
    account' = Map(),
    signInMethods' = Map(),
    signInMethodsShown' = Map(),
    signsInto' = OUTSIDE_ACCOUNTS.mapBy(_ => 0),
    accountCount' = 0,
    offline' = Set(),
    showsSignedIn' = Set(),
  }

  pure def signedIn(account: Device -> int, d: Device): bool =
    account.keys().contains(d)

  /// The account a device is signed in to (0: none).
  pure def accountOf(account: Device -> int, d: Device): int =
    if (signedIn(account, d)) account.get(d) else 0

  pure def _without(account: Device -> int, gone: Set[Device]): Device -> int =
    account.keys().exclude(gone).mapBy(d => account.get(d))

  /// The account a new outside account joins by its verified address (0: none,
  /// so it starts a new account): the one the other outside account at that
  /// address signs into, unless that account already has a sign-in method
  /// from the same company.
  pure def addressMatch(signsInto: OutsideAccount -> int, i: OutsideAccount): int =
    OUTSIDE_ACCOUNTS
      .filter(j =>
        sameAddress(i, j)
          and signsInto.get(j) != 0
          and OUTSIDE_ACCOUNTS.forall(k =>
            signsInto.get(k) != signsInto.get(j) or signInMethodOf(k) != signInMethodOf(i)
          )
      )
      .fold(0, (_, j) => signsInto.get(j))

  /// Sign in with an outside account on a device that is not signed in.
  action signIn(device: Device, identity: OutsideAccount): bool = {
    val existing = signsInto.get(identity)
    val joins = addressMatch(signsInto, identity)
    val target =
      if (existing != 0) existing else if (joins != 0) joins else accountCount + 1
    all {
      not(offline.contains(device)),
      not(showsSignedIn.contains(device)),
      _update(
        account.put(device, target),
        signsInto.set(identity, target),
        if (target > accountCount) target else accountCount,
        offline,
        showsSignedIn.union(Set(device)),
      ),
    }
  }

  /// Offline, start signing in and give up: the app says it failed.
  action abandonSignIn(device: Device, provider: SignInMethod): bool = all {
    offline.contains(device),
    not(showsSignedIn.contains(device)),
    SIGN_IN_METHODS.contains(provider),
    _update(account, signsInto, accountCount, offline, showsSignedIn),
  }

  /// Sign out on this device, online or not.
  action signOut(device: Device): bool = all {
    showsSignedIn.contains(device),
    _update(
      _without(account, Set(device)),
      signsInto,
      accountCount,
      offline,
      showsSignedIn.exclude(Set(device)),
    ),
  }

  /// Connect the sign-in method the account is missing with one of Alice's
  /// outside accounts. One that already signs into another account is refused.
  action connectSignInMethod(device: Device, identity: OutsideAccount): bool = {
    val a = accountOf(account, device)
    all {
      not(offline.contains(device)),
      a != 0,
      not(signInMethods.get(a).contains(signInMethodOf(identity))),
      _update(
        account,
        if (signsInto.get(identity) == 0) signsInto.set(identity, a) else signsInto,
        accountCount,
        offline,
        showsSignedIn,
      ),
    }
  }

  /// Remove one of the account's two sign-in methods.
  action removeSignInMethod(device: Device, provider: SignInMethod): bool = {
    val a = accountOf(account, device)
    all {
      not(offline.contains(device)),
      a != 0,
      signInMethods.get(a).contains(provider),
      signInMethods.get(a).size() > 1,
      _update(
        account,
        OUTSIDE_ACCOUNTS.mapBy(i =>
          if (signsInto.get(i) == a and signInMethodOf(i) == provider) 0
          else signsInto.get(i)
        ),
        accountCount,
        offline,
        showsSignedIn,
      ),
    }
  }

  /// Sign the account out on every device. Online devices show it at once;
  /// offline ones when they are back online.
  action signOutEverywhere(device: Device): bool = {
    val a = accountOf(account, device)
    val ended = account.keys().filter(d => account.get(d) == a)
    all {
      not(offline.contains(device)),
      a != 0,
      _update(
        _without(account, ended),
        signsInto,
        accountCount,
        offline,
        showsSignedIn.exclude(ended.exclude(offline)),
      ),
    }
  }

  /// One device at a time loses its connection.
  action loseConnection(device: Device): bool = all {
    offline == Set(),
    _update(account, signsInto, accountCount, offline.union(Set(device)), showsSignedIn),
  }

  /// Every device is back online, and catches up.
  action reconnect: bool = all {
    offline != Set(),
    _update(account, signsInto, accountCount, Set(), account.keys()),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet identity = OUTSIDE_ACCOUNTS.oneOf()
    nondet provider = SIGN_IN_METHODS.oneOf()
    any {
      signIn(device, identity),
      abandonSignIn(device, provider),
      any { connectSignInMethod(device, identity), removeSignInMethod(device, provider) },
      any { signOut(device), signOutEverywhere(device) },
      any { loseConnection(device), reconnect },
    }
  }

  /// No account ever loses its last sign-in method (so Alice never has more
  /// accounts than outside accounts).
  val invLastMethodStays = and {
    accountCount <= MAX_ACCOUNTS,
    _accounts(accountCount).forall(a => signInMethods.get(a).size() > 0),
  }

  /// An account has at most one outside account per sign-in method.
  val invOnePerSignInMethod = _accounts(accountCount).forall(a =>
    SIGN_IN_METHODS.forall(p =>
      OUTSIDE_ACCOUNTS.filter(i => signsInto.get(i) == a and signInMethodOf(i) == p).size() <= 1
    )
  )

  /// Devices are signed in only to accounts that exist.
  val invRealAccounts = account.keys().forall(d =>
    account.get(d) >= 1 and account.get(d) <= accountCount
  )

  /// An online device shows whether it is signed in as everyone else knows it;
  /// an offline one may still show signed in after it was signed out, never
  /// the reverse.
  val invScreensAgree = DEVICES.forall(d =>
    if (offline.contains(d)) signedIn(account, d) implies showsSignedIn.contains(d)
    else signedIn(account, d) == showsSignedIn.contains(d)
  )
}
