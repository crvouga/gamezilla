// @spec-meta — implementation schema-evolution contract: what someone saved, and how a newer version of the app may grow it.
//
// With no connection, nothing they saved changes: it stays as it was when
// they were cut off, and it is still there when they are back online.
// A newer version may remember something new, fill in a blank, or stop
// showing an old detail. The shared copy never throws a saved value away,
// never turns it into a different kind of thing, and never forgets that an
// old detail existed. The device's own copy drops a detail only once that
// detail has been retired, and the shared copy still holds it so an earlier
// version can read it.
//
// Dangerous attempts — dropping a detail with no permanent record, changing
// its kind, renaming it in place, forgetting the record, or rewriting the
// record's kind — change nothing.
module schema_safety {
  pure val COLS = Set("a", "b")
  pure val TYPES = Set("text", "integer")

  pure def _isLive(s: str): bool =
    or {
      s == "text/live/null",
      s == "text/live/kept",
      s == "integer/live/null",
      s == "integer/live/kept",
    }

  pure def _isLiveNull(s: str): bool =
    s == "text/live/null" or s == "integer/live/null"

  pure def _isKept(s: str): bool =
    or {
      s == "text/live/kept",
      s == "integer/live/kept",
      s == "text/retired/kept",
      s == "integer/retired/kept",
    }

  pure def _isGone(s: str): bool =
    s == "text/retired/gone" or s == "integer/retired/gone"

  pure def _isRetiredStored(s: str): bool =
    or {
      s == "text/retired/null",
      s == "text/retired/kept",
      s == "integer/retired/null",
      s == "integer/retired/kept",
    }

  /// The kind of thing a stored detail is. Never called on an absent detail.
  pure def _typ(s: str): str =
    if (
      or {
        s == "text/live/null",
        s == "text/live/kept",
        s == "text/retired/null",
        s == "text/retired/kept",
        s == "text/retired/gone",
      }
    ) "text"
    else "integer"

  pure def _add(typ: str): str =
    if (typ == "text") "text/live/null" else "integer/live/null"

  pure def _fill(s: str): str =
    if (s == "text/live/null") "text/live/kept"
    else if (s == "integer/live/null") "integer/live/kept"
    else s

  pure def _retireShared(s: str): str =
    if (s == "text/live/null") "text/retired/null"
    else if (s == "text/live/kept") "text/retired/kept"
    else if (s == "integer/live/null") "integer/retired/null"
    else "integer/retired/kept"

  pure def _retireDevice(s: str): str =
    if (s == "text/live/null" or s == "text/live/kept") "text/retired/gone"
    else "integer/retired/gone"

  pure def _copied(s: str): str =
    if (s == "text/live/null") "text/live/kept" else "integer/live/kept"

  /// The shared copy: a detail is absent, held (blank or kept), or retired
  /// and still stored. It is never thrown away.
  var shared: str -> str
  /// The device's own copy. A retired detail is gone here and nowhere else.
  var device: str -> str
  var online: bool
  var _sharedAtCut: str -> str
  var _deviceAtCut: str -> str
  /// A detail whose value has been filled in. It must stay filled on the
  /// shared copy, including after it is retired.
  var _wasKept: str -> bool
  /// The kind a detail had when it was first remembered. Empty if never.
  var _born: str -> str
  /// The kind frozen when a detail was retired. Empty if never retired.
  var _retired: str -> str

  action init = all {
    shared' = COLS.mapBy(_ => "absent"),
    device' = COLS.mapBy(_ => "absent"),
    online' = true,
    _sharedAtCut' = COLS.mapBy(_ => "absent"),
    _deviceAtCut' = COLS.mapBy(_ => "absent"),
    _wasKept' = COLS.mapBy(_ => false),
    _born' = COLS.mapBy(_ => ""),
    _retired' = COLS.mapBy(_ => ""),
  }

  /// Leave every copy as it is. A dangerous attempt ends here.
  action _hold: bool = all {
    shared' = shared,
    device' = device,
    online' = online,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = _wasKept,
    _born' = _born,
    _retired' = _retired,
  }

  /// Remember a new detail. It starts blank, so nothing already saved moves.
  action addColumn(col: str, typ: str): bool = all {
    COLS.contains(col),
    TYPES.contains(typ),
    online,
    shared.get(col) == "absent",
    _retired.get(col) == "",
    shared' = shared.set(col, _add(typ)),
    device' = device.set(col, _add(typ)),
    online' = online,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = _wasKept,
    _born' = _born.set(col, typ),
    _retired' = _retired,
  }

  /// Stop showing a detail. The shared copy keeps its value and its kind;
  /// the device's copy drops it only now.
  action retireColumn(col: str): bool = all {
    COLS.contains(col),
    online,
    _isLive(shared.get(col)),
    shared' = shared.set(col, _retireShared(shared.get(col))),
    device' = device.set(col, _retireDevice(shared.get(col))),
    online' = online,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = _wasKept,
    _born' = _born,
    _retired' = _retired.set(col, _typ(shared.get(col))),
  }

  /// Fill a blank detail. With no connection the blank stays blank: nothing
  /// is rewritten while cut off. A value already kept is never filled over.
  action backfill(col: str): bool = all {
    COLS.contains(col),
    _isLiveNull(shared.get(col)),
    shared' = (if (online) shared.set(col, _fill(shared.get(col))) else shared),
    device' = (if (online) device.set(col, _fill(device.get(col))) else device),
    online' = online,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = (if (online) _wasKept.set(col, true) else _wasKept),
    _born' = _born,
    _retired' = _retired,
  }

  /// Carry a kept value into a new detail of its own kind, leaving the old
  /// one untouched. This is how a kind changes without rewriting the old one.
  action copyIntoNew(col: str, other: str): bool = all {
    COLS.contains(col),
    COLS.contains(other),
    col != other,
    online,
    _isKept(shared.get(col)),
    _isLiveNull(shared.get(other)),
    shared' = shared.set(other, _copied(shared.get(other))),
    device' = device.set(other, _copied(shared.get(other))),
    online' = online,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = _wasKept.set(other, true),
    _born' = _born,
    _retired' = _retired,
  }

  action retype(col: str, typ: str): bool = all {
    COLS.contains(col),
    TYPES.contains(typ),
    _isLive(shared.get(col)),
    _typ(shared.get(col)) != typ,
    _hold,
  }

  action dropColumn(col: str): bool = all {
    COLS.contains(col),
    _isLive(shared.get(col)),
    _hold,
  }

  action forgetTombstone(col: str): bool = all {
    COLS.contains(col),
    _isRetiredStored(shared.get(col)),
    _hold,
  }

  action changeFrozenType(col: str, typ: str): bool = all {
    COLS.contains(col),
    TYPES.contains(typ),
    _isRetiredStored(shared.get(col)),
    _typ(shared.get(col)) != typ,
    _hold,
  }

  action renameInPlace(col: str, other: str): bool = all {
    COLS.contains(col),
    COLS.contains(other),
    col != other,
    _isLive(shared.get(col)),
    _hold,
  }

  action goOffline: bool = all {
    online,
    shared' = shared,
    device' = device,
    online' = false,
    _sharedAtCut' = shared,
    _deviceAtCut' = device,
    _wasKept' = _wasKept,
    _born' = _born,
    _retired' = _retired,
  }

  action goOnline: bool = all {
    not(online),
    shared' = shared,
    device' = device,
    online' = true,
    _sharedAtCut' = _sharedAtCut,
    _deviceAtCut' = _deviceAtCut,
    _wasKept' = _wasKept,
    _born' = _born,
    _retired' = _retired,
  }

  action step = {
    nondet col = COLS.oneOf()
    nondet other = COLS.oneOf()
    nondet typ = TYPES.oneOf()
    any {
      addColumn(col, typ),
      retireColumn(col),
      backfill(col),
      copyIntoNew(col, other),
      retype(col, typ),
      dropColumn(col),
      forgetTombstone(col),
      changeFrozenType(col, typ),
      renameInPlace(col, other),
      goOffline,
      goOnline,
    }
  }

  /// While cut off, both copies stay exactly as they were at the cut.
  val invOfflineHolds =
    not(online) implies (shared == _sharedAtCut and device == _deviceAtCut)

  /// The shared copy never throws a detail away.
  val invSharedKeepsEveryValue = COLS.forall(c => not(_isGone(shared.get(c))))

  /// A value that was filled in stays filled in on the shared copy.
  val invKeptStaysKept =
    COLS.forall(c => _wasKept.get(c) implies _isKept(shared.get(c)))

  /// A detail never changes kind, on either copy.
  val invTypeStays = COLS.forall(c =>
    (_born.get(c) != "") implies
      and {
        _typ(shared.get(c)) == _born.get(c),
        _typ(device.get(c)) == _born.get(c),
      })

  /// Retiring is permanent: the shared copy keeps the frozen kind, and the
  /// device's copy has dropped that detail and only that detail.
  val invTombstoneStays = COLS.forall(c =>
    (_retired.get(c) != "") implies
      and {
        _isRetiredStored(shared.get(c)),
        _typ(shared.get(c)) == _retired.get(c),
        _isGone(device.get(c)),
        _typ(device.get(c)) == _retired.get(c),
      })

  /// The device's copy matches the shared copy, except a retired detail is
  /// gone on the device and still stored, with the same kind, on the shared copy.
  val invCopiesAgree = COLS.forall(c =>
    if (_isGone(device.get(c)))
      (_isRetiredStored(shared.get(c)) and (_typ(device.get(c)) == _typ(shared.get(c))))
    else (device.get(c) == shared.get(c)))
}
