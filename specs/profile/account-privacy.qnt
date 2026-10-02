// Alice and Bob can take private copies of their personal data or permanently
// give up their accounts. Either choice requires signing in again within the
// last ten minutes and a connection. Offline attempts do not wait to happen
// later. Deletion immediately withdraws the account from use; an offline
// device learns that it cannot continue when its connection comes back.
// Ordinary personal data disappears within thirty days. A ready export is
// private to its account and expires seven days after becoming ready.
module account_privacy {
  type Person = str
  type Device = str
  pure val PEOPLE: Set[Person] = Set("alice", "bob")
  pure val DEVICES: Set[Device] = Set("alice-phone", "alice-computer", "bob-phone")
  pure val _personOn: Device -> Person = Map(
    "alice-phone" -> "alice", "alice-computer" -> "alice", "bob-phone" -> "bob",
  )

  /// An account is active, being erased, or fully erased.
  type AccountDeletion = Active | Deleting | Deleted
  /// An export is absent, being prepared, ready, expired, or failed.
  type PersonalDataExport = NoExport | Preparing | Ready | Expired | ExportFailed

  /// Whether an account can still be used or is being erased.
  var deletion: Person -> AccountDeletion
  /// The stage the person sees for their personal-data exports.
  var exports: Person -> PersonalDataExport
  /// The accounts still shown to other people.
  var profilesShown: Set[Person]
  /// Whose ordinary personal data the team has not yet erased.
  var retained: Set[Person]
  /// Which devices still show an account as signed in.
  var signedIn: Set[Device]
  /// Which devices have no connection.
  var offline: Set[Device]

  var _minutes: int
  var _proofAt: Device -> int
  var _deletedAt: Person -> int
  var _requestedAt: Person -> int
  var _readyAt: Person -> int

  action init = all {
    deletion' = PEOPLE.mapBy(_ => Active),
    exports' = PEOPLE.mapBy(_ => NoExport),
    profilesShown' = PEOPLE,
    retained' = PEOPLE,
    signedIn' = DEVICES,
    offline' = Set(),
    _minutes' = 0,
    _proofAt' = DEVICES.mapBy(_ => 0),
    _deletedAt' = PEOPLE.mapBy(_ => -1),
    _requestedAt' = PEOPLE.mapBy(_ => -1),
    _readyAt' = PEOPLE.mapBy(_ => -1),
  }

  def _proven(d: Device): bool =
    signedIn.contains(d) and _minutes - _proofAt.get(d) < 10

  action _keepClocks = all {
    _minutes' = _minutes, _proofAt' = _proofAt,
    _deletedAt' = _deletedAt, _requestedAt' = _requestedAt, _readyAt' = _readyAt,
  }

  /// Alice or Bob proves the active account again by signing in.
  action proveAccount(d: Device): bool = all {
    not(offline.contains(d)), deletion.get(_personOn.get(d)) == Active,
    _proofAt' = _proofAt.set(d, _minutes),
    _minutes' = _minutes, _deletedAt' = _deletedAt,
    _requestedAt' = _requestedAt, _readyAt' = _readyAt,
    deletion' = deletion, exports' = exports, profilesShown' = profilesShown,
    retained' = retained, signedIn' = signedIn.union(Set(d)), offline' = offline,
  }

  /// The person confirms permanent account deletion while online and recently proven.
  action confirmDeletion(d: Device): bool = {
    val p = _personOn.get(d)
    all {
      not(offline.contains(d)), _proven(d), deletion.get(p) == Active,
      deletion' = deletion.set(p, Deleting), exports' = exports.set(p, Expired),
      profilesShown' = profilesShown.exclude(Set(p)), retained' = retained,
      signedIn' = signedIn.filter(x => _personOn.get(x) != p or offline.contains(x)),
      offline' = offline, _deletedAt' = _deletedAt.set(p, _minutes),
      _minutes' = _minutes, _proofAt' = _proofAt,
      _requestedAt' = _requestedAt, _readyAt' = _readyAt,
    }
  }

  /// The person asks for an export of their own active account's personal data.
  action requestExport(d: Device): bool = {
    val p = _personOn.get(d)
    all {
      not(offline.contains(d)), _proven(d), deletion.get(p) == Active,
      exports.get(p) != Preparing,
      exports' = exports.set(p, Preparing), _requestedAt' = _requestedAt.set(p, _minutes),
      deletion' = deletion, profilesShown' = profilesShown, retained' = retained,
      signedIn' = signedIn, offline' = offline,
      _minutes' = _minutes, _proofAt' = _proofAt,
      _deletedAt' = _deletedAt, _readyAt' = _readyAt,
    }
  }

  /// The person's export becomes ready before its twenty-four-hour deadline.
  action exportReady(p: Person): bool = all {
    deletion.get(p) == Active, exports.get(p) == Preparing,
    _minutes - _requestedAt.get(p) <= 1440,
    exports' = exports.set(p, Ready), _readyAt' = _readyAt.set(p, _minutes),
    deletion' = deletion, profilesShown' = profilesShown, retained' = retained,
    signedIn' = signedIn, offline' = offline,
    _minutes' = _minutes, _proofAt' = _proofAt,
    _deletedAt' = _deletedAt, _requestedAt' = _requestedAt,
  }

  /// An unsuccessful exports shows failure and lets the person ask again.
  action exportFails(p: Person): bool = all {
    deletion.get(p) == Active, exports.get(p) == Preparing,
    exports' = exports.set(p, ExportFailed),
    deletion' = deletion, profilesShown' = profilesShown, retained' = retained,
    signedIn' = signedIn, offline' = offline, _keepClocks,
  }

  /// Only the recently proven owner can download a ready, unexpired exports online.
  action downloadExport(d: Device, p: Person): bool = all {
    not(offline.contains(d)), _proven(d), _personOn.get(d) == p,
    deletion.get(p) == Active, exports.get(p) == Ready,
    _minutes - _readyAt.get(p) < 10080,
    deletion' = deletion, exports' = exports, profilesShown' = profilesShown,
    retained' = retained, signedIn' = signedIn, offline' = offline, _keepClocks,
  }

  /// A device goes offline; its picture may be older until it comes back.
  action loseConnection(d: Device): bool = all {
    not(offline.contains(d)), offline' = offline.union(Set(d)),
    deletion' = deletion, exports' = exports, profilesShown' = profilesShown,
    retained' = retained, signedIn' = signedIn, _keepClocks,
  }

  /// A returning device cannot continue using a deleted account.
  action connectionReturns(d: Device): bool = all {
    offline.contains(d), offline' = offline.exclude(Set(d)),
    signedIn' = if (deletion.get(_personOn.get(d)) == Active) signedIn else signedIn.exclude(Set(d)),
    deletion' = deletion, exports' = exports, profilesShown' = profilesShown,
    retained' = retained, _keepClocks,
  }

  /// Time advances; exports expire and ordinary erasure finishes by its deadline.
  action _timePasses(minutes: int): bool = {
    val later = _minutes + minutes
    all {
      minutes > 0,
      PEOPLE.forall(p => exports.get(p) == Preparing implies later - _requestedAt.get(p) <= 1440),
      _minutes' = later,
      exports' = PEOPLE.mapBy(p =>
        if (exports.get(p) == Ready and later - _readyAt.get(p) >= 10080) Expired else exports.get(p)),
      deletion' = PEOPLE.mapBy(p =>
        if (deletion.get(p) == Deleting and later - _deletedAt.get(p) >= 43200) Deleted else deletion.get(p)),
      retained' = retained.filter(p => deletion.get(p) == Active or later - _deletedAt.get(p) < 43200),
      profilesShown' = profilesShown, signedIn' = signedIn, offline' = offline,
      _proofAt' = _proofAt, _deletedAt' = _deletedAt,
      _requestedAt' = _requestedAt, _readyAt' = _readyAt,
    }
  }

  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet elapsed = Set(1, 10, 60, 1440, 10080, 43200).oneOf()
    any {
      proveAccount(d), confirmDeletion(d), requestExport(d),
      exportReady(p), exportFails(p), downloadExport(d, p),
      loseConnection(d), connectionReturns(d), _timePasses(elapsed),
    }
  }

  /// Other people never see an account after its deletion was confirmed.
  val invDeletedProfileHidden = profilesShown == PEOPLE.filter(p => deletion.get(p) == Active)

  /// An online device cannot continue to use a deleted account.
  val invDeletedAccessEnds = DEVICES.forall(d =>
    not(offline.contains(d)) and deletion.get(_personOn.get(d)) != Active implies not(signedIn.contains(d)))

  /// Deleted accounts have no usable export, even if one was ready before deletion.
  val invDeletedExportUnavailable = PEOPLE.forall(p =>
    deletion.get(p) != Active implies exports.get(p) == Expired)

  /// Ordinary personal data cannot survive its deletion deadline.
  val invRetentionDeadline = PEOPLE.forall(p =>
    deletion.get(p) == Deleted implies not(retained.contains(p)))

  /// A ready export is available only within its seven-day lifetime.
  val invExportLifetime = PEOPLE.forall(p =>
    exports.get(p) == Ready implies _minutes - _readyAt.get(p) < 10080)
}
