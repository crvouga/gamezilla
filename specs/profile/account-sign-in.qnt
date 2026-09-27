// Signing in to an account, on two devices.
//
// Alice uses two devices (actors "alice" and "bob"; the second is the other
// device of the sessions feature, where Alice's account is signed in too).
// She has three provider accounts: her Google account, an Apple Account
// registered with the same Gmail address (she shares it with the app), and an
// iCloud Apple Account whose address she hides.
//
// On a device that is not signed in she can sign in with any of them. A
// provider account that already belongs to an app account signs in to it; a
// new one whose verified address matches a provider account of an app
// account that has no method from that provider yet joins that account; any
// other new one starts a new account. Signed in and online, she can connect
// the provider her account is missing (a provider account that already
// belongs to another app account is refused), remove one of two methods (the
// last one always stays), sign out, or sign out of every device. A device can
// lose its connection: it can still sign out there, a sign-in she starts
// there fails when she gives up on it, and it still shows the sign-in methods
// it last saw until the connection comes back. Signing out everywhere ends
// the account's session on every device at once; a device that is offline
// only notices once it is back online.
module account_sign_in {
  type Device = str
  type Provider = str
  type Identity = str

  pure val DEVICES: Set[Device] = Set("alice", "bob")

  /// Alice's provider accounts.
  pure val IDENTITIES: Set[Identity] = Set("google", "appleShared", "appleHidden")

  pure val PROVIDERS: Set[Provider] = Set("google", "apple")

  pure def providerOf(i: Identity): Provider =
    if (i == "google") "google" else "apple"

  /// The Google account and the Gmail Apple Account share one verified
  /// address; the hidden iCloud address matches nothing.
  pure def sameAddress(i: Identity, j: Identity): bool =
    i != j and Set(i, j) == Set("google", "appleShared")

  /// The app account (numbered in the order they were created) each device
  /// is signed in to, by the server's verdict. A device not signed in is not
  /// listed.
  var account: Device -> int
  /// Every app account's sign-in methods, as the server holds them.
  var methods: int -> Set[Provider]
  /// The sign-in methods each signed-in device shows (its synced copy).
  var shown: Device -> Set[Provider]

  /// Which app account holds each provider account (0: none).
  var owner: Identity -> int
  /// How many app accounts exist.
  var created: int
  /// The devices that have lost their connection.
  var offline: Set[Device]
  /// The devices whose screen says they are signed in (an offline device
  /// has not yet heard that its session ended).
  var looksSignedIn: Set[Device]

  pure def methodsOf(owner: Identity -> int, created: int): int -> Set[Provider] =
    1.to(created).mapBy(a => IDENTITIES.filter(i => owner.get(i) == a).map(providerOf))

  /// Online devices show what the server holds; offline ones what they last saw.
  pure def mirror(
    prev: Device -> Set[Provider],
    account: Device -> int,
    offline: Set[Device],
    methods: int -> Set[Provider],
  ): Device -> Set[Provider] =
    account.keys().mapBy(d =>
      if (offline.contains(d) and prev.keys().contains(d)) prev.get(d)
      else methods.get(account.get(d))
    )

  action update(
    newAccount: Device -> int,
    newOwner: Identity -> int,
    newCreated: int,
    newOffline: Set[Device],
    newLooks: Set[Device],
  ): bool = {
    val newMethods = methodsOf(newOwner, newCreated)
    all {
      account' = newAccount,
      owner' = newOwner,
      created' = newCreated,
      offline' = newOffline,
      looksSignedIn' = newLooks,
      methods' = newMethods,
      shown' = mirror(shown, newAccount, newOffline, newMethods),
    }
  }

  action init = all {
    account' = Map(),
    methods' = Map(),
    shown' = Map(),
    owner' = IDENTITIES.mapBy(_ => 0),
    created' = 0,
    offline' = Set(),
    looksSignedIn' = Set(),
  }

  pure def signedIn(account: Device -> int, d: Device): bool =
    account.keys().contains(d)

  /// The account a device is signed in to (0: none).
  pure def accountOf(account: Device -> int, d: Device): int =
    if (signedIn(account, d)) account.get(d) else 0

  pure def without(account: Device -> int, gone: Set[Device]): Device -> int =
    account.keys().exclude(gone).mapBy(d => account.get(d))

  /// The app account a provider account that belongs to none joins by its
  /// verified address (0: none, so it starts a new account): the one holding
  /// the other provider account at that address, unless that account already
  /// has a method from the same provider.
  pure def matchOf(owner: Identity -> int, i: Identity): int =
    IDENTITIES
      .filter(j =>
        sameAddress(i, j)
          and owner.get(j) != 0
          and IDENTITIES.forall(k =>
            owner.get(k) != owner.get(j) or providerOf(k) != providerOf(i)
          )
      )
      .fold(0, (_, j) => owner.get(j))

  /// Sign in with a provider account on a device showing "Sign in".
  action signIn(device: Device, identity: Identity): bool = {
    val existing = owner.get(identity)
    val joins = matchOf(owner, identity)
    val target =
      if (existing != 0) existing else if (joins != 0) joins else created + 1
    all {
      not(offline.contains(device)),
      not(looksSignedIn.contains(device)),
      update(
        account.put(device, target),
        owner.set(identity, target),
        if (target > created) target else created,
        offline,
        looksSignedIn.union(Set(device)),
      ),
    }
  }

  /// Offline, start signing in and give up: the app says it failed.
  action abandonSignIn(device: Device, provider: Provider): bool = all {
    offline.contains(device),
    not(looksSignedIn.contains(device)),
    PROVIDERS.contains(provider),
    update(account, owner, created, offline, looksSignedIn),
  }

  /// Sign out on this device, online or not.
  action signOut(device: Device): bool = all {
    looksSignedIn.contains(device),
    update(
      without(account, Set(device)),
      owner,
      created,
      offline,
      looksSignedIn.exclude(Set(device)),
    ),
  }

  /// Connect the provider the account is missing with one of Alice's
  /// provider accounts. One that belongs to another app account is refused.
  action connect(device: Device, identity: Identity): bool = {
    val a = accountOf(account, device)
    all {
      not(offline.contains(device)),
      a != 0,
      not(methods.get(a).contains(providerOf(identity))),
      update(
        account,
        if (owner.get(identity) == 0) owner.set(identity, a) else owner,
        created,
        offline,
        looksSignedIn,
      ),
    }
  }

  /// Remove one of the account's two sign-in methods.
  action remove(device: Device, provider: Provider): bool = {
    val a = accountOf(account, device)
    all {
      not(offline.contains(device)),
      a != 0,
      methods.get(a).contains(provider),
      methods.get(a).size() > 1,
      update(
        account,
        IDENTITIES.mapBy(i =>
          if (owner.get(i) == a and providerOf(i) == provider) 0
          else owner.get(i)
        ),
        created,
        offline,
        looksSignedIn,
      ),
    }
  }

  /// End the account's session on every device. Online devices show it at
  /// once; offline ones when they are back.
  action signOutEverywhere(device: Device): bool = {
    val a = accountOf(account, device)
    val ended = account.keys().filter(d => account.get(d) == a)
    all {
      not(offline.contains(device)),
      a != 0,
      update(
        without(account, ended),
        owner,
        created,
        offline,
        looksSignedIn.exclude(ended.exclude(offline)),
      ),
    }
  }

  /// One device at a time loses its connection.
  action loseConnection(device: Device): bool = all {
    offline == Set(),
    update(account, owner, created, offline.union(Set(device)), looksSignedIn),
  }

  /// Every device is back online, and catches up.
  action reconnect: bool = all {
    offline != Set(),
    update(account, owner, created, Set(), account.keys()),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet identity = IDENTITIES.oneOf()
    nondet provider = PROVIDERS.oneOf()
    any {
      signIn(device, identity),
      abandonSignIn(device, provider),
      any { connect(device, identity), remove(device, provider) },
      any { signOut(device), signOutEverywhere(device) },
      any { loseConnection(device), reconnect },
    }
  }

  /// No account ever loses its last sign-in method.
  val invLastMethodStays = 1.to(created).forall(a => methods.get(a).size() > 0)

  /// An account has at most one provider account per provider.
  val invOnePerProvider = 1.to(created).forall(a =>
    PROVIDERS.forall(p =>
      IDENTITIES.filter(i => owner.get(i) == a and providerOf(i) == p).size() <= 1
    )
  )

  /// Devices are signed in only to accounts that exist.
  val invRealAccounts = account.keys().forall(d =>
    account.get(d) >= 1 and account.get(d) <= created
  )

  /// An online device's screen agrees with the server; an offline one may
  /// still look signed in after its session ended, never the reverse.
  val invScreensAgree = DEVICES.forall(d =>
    if (offline.contains(d)) signedIn(account, d) implies looksSignedIn.contains(d)
    else signedIn(account, d) == looksSignedIn.contains(d)
  )
}
