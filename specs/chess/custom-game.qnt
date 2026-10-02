// A Custom Game belongs to the host of its space. White and Black may be
// people, bots, invitations, open places or closed sides while configuring.
// People choose whether to accept and become ready. The creator may watch.
// A start fixes the participants and choices. A finished or cancelled game
// stays that way; a new game or rematch is a separate Custom Game.
// Every change needs a connection. Offline people keep their last picture,
// do not acquire a side or start later on their own, and see the current game
// when back online. An acknowledged choice survives closing the app.
// Simultaneous choices may succeed in either order; an earlier choice cannot
// overwrite a newer one. Chess endings finish the same game; chess moves and
// clocks are governed by chess, rather than a second set of move rules here.
module custom_game {
  type Person = str
  type Side = str
  type Participant = { kind: str, person: str }
  type CustomGame = {
    status: str, creator: str, white: Participant, black: Participant,
    ready: Set[str], minutes: int, increment: int, starts: int,
    outcome: str, drawOfferedBy: str,
  }
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val DEVICES = PEOPLE.union(Set("alice-other"))
  pure def _personOf(device: str): Person = if(device == "alice-other") "alice" else device
  pure val SIDES = Set("white", "black")
  // Untimed and two different timed choices cover choice changes. The full
  // admitted ranges and their boundaries are illustrated in the clock rules.
  pure val TIMES = Set(0, 1, 5)
  pure val INCREMENTS = Set(0, 2)
  pure val _EMPTY = { kind: "open", person: "" }
  pure val _BOT = { kind: "bot", person: "" }
  pure val _CLOSED = { kind: "closed", person: "" }
  pure val _INITIAL = {
    status: "none", creator: "", white: _EMPTY, black: _EMPTY,
    ready: Set(), minutes: 0, increment: 0, starts: 0,
    outcome: "", drawOfferedBy: "",
  }
  pure val _COMMANDS = Set("take", "bot", "open", "close", "invite", "accept", "decline", "revoke", "claim", "release", "ready", "unready", "swap", "clock", "start", "cancel", "resign", "offer", "agree", "reject", "create", "rematch")

  /// The agreed Custom Game, including its visible result and readiness.
  var status: str
  var creator: str
  var white: Participant
  var black: Participant
  var ready: Set[str]
  var minutes: int
  var increment: int
  var starts: int
  var outcome: str
  var drawOfferedBy: str
  val customGame = {status: status, creator: creator, white: white, black: black, ready: ready, minutes: minutes, increment: increment, starts: starts, outcome: outcome, drawOfferedBy: drawOfferedBy}
  /// Each person's last picture of the Custom Game.
  var statusShown: Person -> str
  var creatorShown: Person -> str
  var whiteShown: Person -> Participant
  var blackShown: Person -> Participant
  var readyShown: Person -> Set[str]
  var minutesShown: Person -> int
  var incrementShown: Person -> int
  var startsShown: Person -> int
  var outcomeShown: Person -> str
  var drawOfferedByShown: Person -> str
  val gameShown = DEVICES.mapBy(p => {status: statusShown.get(p), creator: creatorShown.get(p), white: whiteShown.get(p), black: blackShown.get(p), ready: readyShown.get(p), minutes: minutesShown.get(p), increment: incrementShown.get(p), starts: startsShown.get(p), outcome: outcomeShown.get(p), drawOfferedBy: drawOfferedByShown.get(p)})
  /// The reason each person is told their last choice did not take effect.
  var refusal: Person -> str
  var _offline: Set[Person]
  var _signedOut: Set[Person]
  var _members: Set[Person]
  var _spaceEnded: bool
  var _frozen: (Participant, Participant, int, int)
  var _sealed: bool
  var _cutOffStatus: Person -> str
  var _cutOffCreator: Person -> str
  var _cutOffWhite: Person -> Participant
  var _cutOffBlack: Person -> Participant
  var _cutOffReady: Person -> Set[str]
  var _cutOffMinutes: Person -> int
  var _cutOffIncrement: Person -> int
  var _cutOffStarts: Person -> int
  var _cutOffOutcome: Person -> str
  var _cutOffDrawofferedby: Person -> str

  pure def _side(g: CustomGame, side: Side): Participant = if (side == "white") g.white else g.black
  pure def _other(side: Side): Side = if (side == "white") "black" else "white"
  pure def _personSide(g: CustomGame, person: Person): str =
    if (g.white.kind == "person" and g.white.person == person) "white"
    else if (g.black.kind == "person" and g.black.person == person) "black" else ""
  pure def _reserved(g: CustomGame, person: Person): bool =
    Set("person", "invitation").contains(g.white.kind) and g.white.person == person or
    Set("person", "invitation").contains(g.black.kind) and g.black.person == person
  pure def _replace(g: CustomGame, side: Side, p: Participant): CustomGame =
    if (_side(g, side) == p) g
    else if (side == "white") { ...g, white: p, ready: Set() }
    else { ...g, black: p, ready: Set() }
  pure def _config(g: CustomGame): (Participant, Participant, int, int) = (g.white, g.black, g.minutes, g.increment)
  pure def _terminal(g: CustomGame): bool = Set("completed", "cancelled").contains(g.status)
  pure def _startable(g: CustomGame): bool = SIDES.forall(s =>
    _side(g,s).kind == "bot" or (_side(g,s).kind == "person" and g.ready.contains(s)))
  pure def _creatorCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "revoke", "swap", "clock", "start", "cancel", "create", "rematch").contains(c)
  pure def _settingCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "accept", "decline", "revoke", "claim", "release", "ready", "unready", "swap", "clock").contains(c)

  def _reason(g: CustomGame, actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): str = {
    val sender = _personOf(actor)
    val occupied = _side(g, side)
    if (_signedOut.contains(actor) or _spaceEnded or not(_members.contains(sender))) "not in the space"
    else if (_creatorCommand(c) and sender != "alice") "only the creator"
    else if (Set("create", "rematch").contains(c)) {
      if (g.status == "none" and c == "rematch") "no finished game"
      else if (g.status != "none" and not(_terminal(g))) "finish or cancel first" else ""
    }
    else if (g.status == "none") "no Custom Game"
    else if (g.status == "completed") "finished"
    else if (g.status == "cancelled") "cancelled"
    else if (_settingCommand(c) and g.status != "configuring") "already started"
    else if (c == "take" and _reserved(g, sender) and occupied.person != sender) "one side per person"
    else if (c == "invite" and not(_members.contains(person))) "person not in the space"
    else if (c == "invite" and _reserved(g, person) and occupied.person != person) "one side per person"
    else if (Set("accept", "decline").contains(c) and (occupied.kind != "invitation" or occupied.person != sender)) "not your invitation"
    else if (c == "revoke" and occupied.kind != "invitation") "no invitation"
    else if (c == "claim" and occupied.kind != "open") {
      if (occupied.kind == "person" and occupied.person == sender) "" else "not an open place"
    }
    else if (c == "claim" and _reserved(g, sender)) "one side per person"
    else if (c == "release" and (occupied.kind != "person" or occupied.person != sender)) "not your side"
    else if (Set("ready", "unready", "resign", "offer").contains(c) and _personSide(g,sender) == "") "not a participant"
    else if (c == "clock" and (not(TIMES.contains(minutes)) or not(INCREMENTS.contains(increment)) or (minutes == 0 and increment != 0))) "invalid time choice"
    else if (c == "start" and g.status == "configuring" and not(SIDES.forall(s => Set("person", "bot").contains(_side(g,s).kind)))) "both sides need participants"
    else if (c == "start" and g.status == "configuring" and not(_startable(g))) "every person must be ready"
    else if (Set("resign", "offer", "agree", "reject").contains(c) and g.status != "active") "not started"
    else if (Set("agree", "reject").contains(c) and (_personSide(g,sender) == "" or g.drawOfferedBy == "" or g.drawOfferedBy == sender)) "not the other participant"
    else if (c == "offer" and (g.white.kind != "person" or g.black.kind != "person")) "draw agreement needs two people"
    else ""
  }

  def _inherited(p: Participant): Participant =
    if (p.kind == "bot" or (p.kind == "person" and _members.contains(p.person))) p else _EMPTY

  def _next(g: CustomGame, actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): CustomGame =
    if (_reason(g,actor,c,side,person,minutes,increment) != "") g
    else if (c == "create") { ..._INITIAL, status: "configuring", creator: _personOf(actor), white: {kind: "person", person: _personOf(actor)} }
    else if (c == "rematch") { ...g, status: "configuring", white: _inherited(g.black), black: _inherited(g.white), ready: Set(), starts: 0, outcome: "", drawOfferedBy: "" }
    else if (c == "take") _replace(g,side,{kind: "person", person: _personOf(actor)})
    else if (c == "bot") _replace(g,side,_BOT)
    else if (c == "open" or c == "revoke" or c == "decline" or c == "release") _replace(g,side,_EMPTY)
    else if (c == "close") _replace(g,side,_CLOSED)
    else if (c == "invite") _replace(g,side,{kind: "invitation", person: person})
    else if (c == "accept" or c == "claim") _replace(g,side,{kind: "person", person: _personOf(actor)})
    else if (c == "ready") {...g, ready: g.ready.union(Set(_personSide(g,_personOf(actor))))}
    else if (c == "unready") {...g, ready: g.ready.exclude(Set(_personSide(g,_personOf(actor))))}
    else if (c == "swap") {...g, white: g.black, black: g.white, ready: Set()}
    else if (c == "clock") {
      if (g.minutes == minutes and g.increment == increment) g
      else {...g, minutes: minutes, increment: increment, ready: Set()}
    }
    else if (c == "start") {
      if (g.status == "active") g
      else {...g, status: "active", starts: 1}
    }
    else if (c == "cancel") {...g, status: "cancelled", outcome: "cancelled", drawOfferedBy: "", white: if (g.white.kind == "invitation") _EMPTY else g.white, black: if (g.black.kind == "invitation") _EMPTY else g.black, ready: Set()}
    else if (c == "resign") {...g, status: "completed", outcome: if (_personSide(g,_personOf(actor)) == "white") "black wins by resignation" else "white wins by resignation", drawOfferedBy: ""}
    else if (c == "offer") {...g, drawOfferedBy: _personOf(actor)}
    else if (c == "agree") {...g, status: "completed", outcome: "draw", drawOfferedBy: ""}
    else if (c == "reject") {...g, drawOfferedBy: ""}
    else g

  action _update(g: CustomGame, offline: Set[Person], members: Set[Person], signedOut: Set[Person], reasons: Person -> str, fresh: bool): bool = all {
    status' = g.status,
    creator' = g.creator,
    white' = g.white,
    black' = g.black,
    ready' = g.ready,
    minutes' = g.minutes,
    increment' = g.increment,
    starts' = g.starts,
    outcome' = g.outcome,
    drawOfferedBy' = g.drawOfferedBy,
    _offline' = offline,
    _signedOut' = signedOut,
    refusal' = reasons,
    statusShown' = DEVICES.mapBy(p => if (offline.contains(p)) statusShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.status else _INITIAL.status),
    creatorShown' = DEVICES.mapBy(p => if (offline.contains(p)) creatorShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.creator else _INITIAL.creator),
    whiteShown' = DEVICES.mapBy(p => if (offline.contains(p)) whiteShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.white else _INITIAL.white),
    blackShown' = DEVICES.mapBy(p => if (offline.contains(p)) blackShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.black else _INITIAL.black),
    readyShown' = DEVICES.mapBy(p => if (offline.contains(p)) readyShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.ready else _INITIAL.ready),
    minutesShown' = DEVICES.mapBy(p => if (offline.contains(p)) minutesShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.minutes else _INITIAL.minutes),
    incrementShown' = DEVICES.mapBy(p => if (offline.contains(p)) incrementShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.increment else _INITIAL.increment),
    startsShown' = DEVICES.mapBy(p => if (offline.contains(p)) startsShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.starts else _INITIAL.starts),
    outcomeShown' = DEVICES.mapBy(p => if (offline.contains(p)) outcomeShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.outcome else _INITIAL.outcome),
    drawOfferedByShown' = DEVICES.mapBy(p => if (offline.contains(p)) drawOfferedByShown.get(p) else if (members.contains(_personOf(p)) and not(signedOut.contains(p))) g.drawOfferedBy else _INITIAL.drawOfferedBy),
    _frozen' = if (fresh) _config(_INITIAL) else if (g.starts == 1 and customGame.starts == 0) _config(g) else _frozen,
    _sealed' = (if (fresh) false else _sealed or _terminal(g)),
    _members' = members,
    _spaceEnded' = (_spaceEnded or not(members.contains("alice"))),
    _cutOffStatus' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) statusShown.get(p) else _cutOffStatus.get(p)),
    _cutOffCreator' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) creatorShown.get(p) else _cutOffCreator.get(p)),
    _cutOffWhite' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) whiteShown.get(p) else _cutOffWhite.get(p)),
    _cutOffBlack' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) blackShown.get(p) else _cutOffBlack.get(p)),
    _cutOffReady' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) readyShown.get(p) else _cutOffReady.get(p)),
    _cutOffMinutes' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) minutesShown.get(p) else _cutOffMinutes.get(p)),
    _cutOffIncrement' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) incrementShown.get(p) else _cutOffIncrement.get(p)),
    _cutOffStarts' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) startsShown.get(p) else _cutOffStarts.get(p)),
    _cutOffOutcome' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) outcomeShown.get(p) else _cutOffOutcome.get(p)),
    _cutOffDrawofferedby' = DEVICES.mapBy(p => if (offline.contains(p) and not(_offline.contains(p))) drawOfferedByShown.get(p) else _cutOffDrawofferedby.get(p)),
  }

  action _do(actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): bool = {
    val reason = if (_offline.contains(actor)) "connection needed" else _reason(customGame,actor,c,side,person,minutes,increment)
    val changed = if (reason != "") customGame else _next(customGame,actor,c,side,person,minutes,increment)
    _update(changed,_offline,_members,_signedOut,refusal.set(actor,reason), changed != customGame and Set("create","rematch").contains(c))
  }

  pure val _BEGIN = {..._INITIAL, status: "configuring", creator: "alice", white: {kind: "person", person: "alice"}}
  action init = {
    nondet beginning = Set("choices","people","bots","playing","offering","empty").oneOf()
    val people = {..._BEGIN, black: {kind: "person", person: "bob"}, ready: SIDES}
    val g = if (beginning == "empty") _INITIAL
      else if (beginning == "people") people
      else if (beginning == "bots") {..._BEGIN, white: _BOT, black: _BOT}
      else if (beginning == "playing" or beginning == "offering") {...people, status: "active", starts: 1, drawOfferedBy: if(beginning == "offering") "alice" else ""}
      else _BEGIN
    all {
      status' = g.status,
    creator' = g.creator,
    white' = g.white,
    black' = g.black,
    ready' = g.ready,
    minutes' = g.minutes,
    increment' = g.increment,
    starts' = g.starts,
    outcome' = g.outcome,
    drawOfferedBy' = g.drawOfferedBy,
      statusShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.status else g.status),
      creatorShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.creator else g.creator),
      whiteShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.white else g.white),
      blackShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.black else g.black),
      readyShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.ready else g.ready),
      minutesShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.minutes else g.minutes),
      incrementShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.increment else g.increment),
      startsShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.starts else g.starts),
      outcomeShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.outcome else g.outcome),
      drawOfferedByShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.drawOfferedBy else g.drawOfferedBy),
      refusal' = DEVICES.mapBy(_ => ""),
      _offline' = Set(), _members' = Set("alice","bob"), _spaceEnded' = false, _signedOut' = Set(),
      _frozen' = if (g.starts == 1) _config(g) else _config(_INITIAL), _sealed' = false,
      _cutOffStatus' = DEVICES.mapBy(_ => _INITIAL.status),
      _cutOffCreator' = DEVICES.mapBy(_ => _INITIAL.creator),
      _cutOffWhite' = DEVICES.mapBy(_ => _INITIAL.white),
      _cutOffBlack' = DEVICES.mapBy(_ => _INITIAL.black),
      _cutOffReady' = DEVICES.mapBy(_ => _INITIAL.ready),
      _cutOffMinutes' = DEVICES.mapBy(_ => _INITIAL.minutes),
      _cutOffIncrement' = DEVICES.mapBy(_ => _INITIAL.increment),
      _cutOffStarts' = DEVICES.mapBy(_ => _INITIAL.starts),
      _cutOffOutcome' = DEVICES.mapBy(_ => _INITIAL.outcome),
      _cutOffDrawofferedby' = DEVICES.mapBy(_ => _INITIAL.drawOfferedBy),
    }
  }

  /// A person creates a Custom Game for the same Custom Game, or hears why it is refused.
  action createGame(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"create","white",actor,0,0) == "", _do(actor,"create","white",actor,0,0) }

  /// A person creates a rematch for the same Custom Game, or hears why it is refused.
  action rematch(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"rematch","white",actor,0,0) == "", _do(actor,"rematch","white",actor,0,0) }

  /// A person takes a side for the same Custom Game, or hears why it is refused.
  action takeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"take",side,actor,0,0) == "", _do(actor,"take",side,actor,0,0) }

  /// A person assigns a bot for the same Custom Game, or hears why it is refused.
  action assignBot(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"bot",side,actor,0,0) == "", _do(actor,"bot",side,actor,0,0) }

  /// A person opens a side for the same Custom Game, or hears why it is refused.
  action openSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"open",side,actor,0,0) == "", _do(actor,"open",side,actor,0,0) }

  /// A person closes a side for the same Custom Game, or hears why it is refused.
  action closeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"close",side,actor,0,0) == "", _do(actor,"close",side,actor,0,0) }

  /// A person invites another person for the same Custom Game, or hears why it is refused.
  action invite(actor: Person, side: Side, person: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"invite",side,person,0,0) == "", _do(actor,"invite",side,person,0,0) }

  /// A person accepts an invitation for the same Custom Game, or hears why it is refused.
  action acceptSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"accept",side,actor,0,0) == "", _do(actor,"accept",side,actor,0,0) }

  /// A person declines an invitation for the same Custom Game, or hears why it is refused.
  action declineSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"decline",side,actor,0,0) == "", _do(actor,"decline",side,actor,0,0) }

  /// A person revokes an invitation for the same Custom Game, or hears why it is refused.
  action revokeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"revoke",side,actor,0,0) == "", _do(actor,"revoke",side,actor,0,0) }

  /// A person claims an open place for the same Custom Game, or hears why it is refused.
  action claimSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"claim",side,actor,0,0) == "", _do(actor,"claim",side,actor,0,0) }

  /// A person releases their side for the same Custom Game, or hears why it is refused.
  action releaseSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"release",side,actor,0,0) == "", _do(actor,"release",side,actor,0,0) }

  /// A person becomes ready for the same Custom Game, or hears why it is refused.
  action becomeReady(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"ready","white",actor,0,0) == "", _do(actor,"ready","white",actor,0,0) }

  /// A person withdraws readiness for the same Custom Game, or hears why it is refused.
  action becomeUnready(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"unready","white",actor,0,0) == "", _do(actor,"unready","white",actor,0,0) }

  /// A person swaps the sides for the same Custom Game, or hears why it is refused.
  action swapSides(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"swap","white",actor,0,0) == "", _do(actor,"swap","white",actor,0,0) }

  /// A person chooses the time for the same Custom Game, or hears why it is refused.
  action chooseClock(actor: Person, minutes: int, increment: int): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"clock","white",actor,minutes,increment) == "", _do(actor,"clock","white",actor,minutes,increment) }

  /// A person starts the game for the same Custom Game, or hears why it is refused.
  action startGame(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"start","white",actor,0,0) == "", _do(actor,"start","white",actor,0,0) }

  /// A person cancels the game for the same Custom Game, or hears why it is refused.
  action cancelGame(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"cancel","white",actor,0,0) == "", _do(actor,"cancel","white",actor,0,0) }

  /// A person resigns the game for the same Custom Game, or hears why it is refused.
  action resignGame(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"resign","white",actor,0,0) == "", _do(actor,"resign","white",actor,0,0) }

  /// A person offers a draw for the same Custom Game, or hears why it is refused.
  action offerDraw(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"offer","white",actor,0,0) == "", _do(actor,"offer","white",actor,0,0) }

  /// A person accepts a draw for the same Custom Game, or hears why it is refused.
  action acceptDraw(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"agree","white",actor,0,0) == "", _do(actor,"agree","white",actor,0,0) }

  /// A person declines a draw for the same Custom Game, or hears why it is refused.
  action declineDraw(actor: Person): bool = all { not(_offline.contains(actor)), _reason(customGame,actor,"reject","white",actor,0,0) == "", _do(actor,"reject","white",actor,0,0) }

  /// A chess ending finishes an active game without changing its choices.
  action _finishGame(result: str): bool = all {
    customGame.status == "active",
    customGame.white.kind == "person", customGame.black.kind == "person",
    customGame.minutes > 0 or Set("white wins by checkmate", "black wins by checkmate", "draw").contains(result),
    _update({...customGame, status: "completed", outcome: result, drawOfferedBy: ""}, _offline, _members,_signedOut, refusal, false),
  }
  /// A disconnected person retains their last picture, with no delayed choices.
  action _loseConnection(actor: Person): bool = all {
    not(_offline.contains(actor)),
    _update(customGame,_offline.union(Set(actor)),_members,_signedOut,refusal,false),
  }
  /// Returning brings the person's picture to the agreed game.
  action _connectionReturns(actor: Person): bool = all {
    _offline.contains(actor),
    _update(customGame,_offline.exclude(Set(actor)),_members,_signedOut,refusal,false),
  }
  /// Closing and reopening keeps acknowledged choices.
  action _reopenApp(actor: Person): bool = _update(customGame,_offline,_members,_signedOut,refusal,false)
  /// Hearing an acknowledged action again has no second product effect.
  action _repeatAcknowledged: bool = _update(customGame,_offline,_members,_signedOut,refusal,false)
  /// Earlier choices never replace choices that have already changed.
  action _staleChoice(actor: Person): bool = all { customGame.status != "none", _update(customGame,_offline,_members,_signedOut,refusal.set(actor,if (_offline.contains(actor)) "connection needed" else if(_signedOut.contains(actor) or not(_members.contains(_personOf(actor)))) "not in the space" else "choices changed"),false) }
  /// Two choices made together may be accepted in either order. A choice
  /// that changed the participants or time stops the other from using earlier choices.
  /// Readiness and starting do not replace those choices; each ready person
  /// can agree, and two starts keep the same game.
  action _competingChoices(actor: Person, other: Person, command: str, otherCommand: str, side: Side, otherSide: Side, person: Person): bool = {
    val firstReason = if (_offline.contains(actor)) "connection needed" else _reason(customGame,actor,command,side,person,1,0)
    val first = if (firstReason != "") customGame else _next(customGame,actor,command,side,person,1,0)
    val authority = if(_signedOut.contains(other) or _spaceEnded or not(_members.contains(_personOf(other)))) "not in the space" else if(_creatorCommand(otherCommand) and _personOf(other) != "alice") "only the creator" else ""
    val choicesChanged = _config(first) != _config(customGame) or (first != customGame and Set("create","rematch").contains(command))
    val secondReason = if (_offline.contains(other)) "connection needed" else if(authority != "") authority else if (choicesChanged) "choices changed" else _reason(first,other,otherCommand,otherSide,person,1,0)
    val second = if (secondReason != "") first else _next(first,other,otherCommand,otherSide,person,1,0)
    val fresh = (first != customGame and Set("create","rematch").contains(command)) or (second != first and Set("create","rematch").contains(otherCommand))
    _update(second,_offline,_members,_signedOut,refusal.set(actor,firstReason).set(other,secondReason),fresh)
  }

  /// Every expressible refused choice leaves the agreed game intact.
  action _attemptChoice(actor: Person, command: str, side: Side, person: Person): bool = all {
    _offline.contains(actor) or _reason(customGame,actor,command,side,person,1,0) != "",
    _do(actor,command,side,person,1,0),
  }

  /// Leaving releases a waiting side; an active participant resigns.
  /// The creator leaving ends the space and cancels an unfinished game.
  action _personLeaves(actor: Person): bool = all {
    _members.contains(_personOf(actor)), not(_offline.contains(actor)),
    val waiting = SIDES.fold(customGame, (g,s) => if (_side(g,s).person == _personOf(actor)) _replace(g,s,_EMPTY) else g)
    val changed = if (_personOf(actor) == "alice" and customGame.status != "none" and not(_terminal(customGame)))
      {...customGame, status: "cancelled", outcome: "cancelled", ready: Set(), drawOfferedBy: "", white: if (customGame.white.kind == "invitation") _EMPTY else customGame.white, black: if (customGame.black.kind == "invitation") _EMPTY else customGame.black}
      else if (customGame.status == "configuring") waiting
      else if (customGame.status == "active" and _personSide(customGame,_personOf(actor)) != "") {...customGame,status:"completed",outcome:if(_personSide(customGame,_personOf(actor)) == "white") "black wins by resignation" else "white wins by resignation",drawOfferedBy:""}
      else customGame
    _update(changed,_offline,if (_personOf(actor) == "alice") Set() else _members.exclude(Set(_personOf(actor))),_signedOut,refusal,false),
  }
  /// Rejoining the space does not take a side automatically.
  action _personJoins(actor: Person): bool = all {
    not(_spaceEnded), not(_members.contains(_personOf(actor))), not(_offline.contains(actor)),
    _update(customGame,_offline,_members.union(Set(_personOf(actor))),_signedOut,refusal,false),
  }

  /// Signing out removes this device's account picture and control, not its membership.
  action _signOut(actor: Person): bool = all {
    not(_offline.contains(actor)), not(_signedOut.contains(actor)),
    _update(customGame,_offline,_members,_signedOut.union(Set(actor)),refusal,false),
  }
  /// Signing in to the same account brings back its current game and side.
  action _signIn(actor: Person): bool = all {
    not(_offline.contains(actor)), _signedOut.contains(actor),
    _update(customGame,_offline,_members,_signedOut.exclude(Set(actor)),refusal,false),
  }
  /// Identity changes the name displayed for the same participant.
  /// Names are not a second controller; the sides and game remain the same.
  action _usernameChanges(actor: Person): bool = _update(customGame,_offline,_members,_signedOut,refusal,false)

  action step = {
    nondet actor = DEVICES.oneOf()
    nondet other = DEVICES.oneOf()
    nondet person = PEOPLE.oneOf()
    nondet side = SIDES.oneOf()
    nondet minutes = TIMES.oneOf()
    nondet increment = INCREMENTS.oneOf()
    nondet result = Set("white wins by checkmate", "black wins by checkmate", "draw", "white wins on time", "black wins on time").oneOf()
    nondet command = _COMMANDS.oneOf()
    nondet otherCommand = _COMMANDS.oneOf()
    nondet otherSide = SIDES.oneOf()
    any {
      createGame(actor),
      rematch(actor),
      takeSide(actor, side),
      assignBot(actor, side),
      openSide(actor, side),
      closeSide(actor, side),
      invite(actor, side, person),
      acceptSide(actor, side),
      declineSide(actor, side),
      revokeSide(actor, side),
      claimSide(actor, side),
      releaseSide(actor, side),
      becomeReady(actor),
      becomeUnready(actor),
      swapSides(actor),
      chooseClock(actor, minutes, increment),
      startGame(actor),
      cancelGame(actor),
      resignGame(actor),
      offerDraw(actor),
      acceptDraw(actor),
      declineDraw(actor),
      _finishGame(result), _loseConnection(actor), _connectionReturns(actor),
      _signOut(actor), _signIn(actor), _usernameChanges(actor), _personLeaves(actor), _personJoins(actor), _reopenApp(actor), _repeatAcknowledged, _staleChoice(actor), _attemptChoice(actor,command,side,person),
      _competingChoices(actor,other,command,otherCommand,side,otherSide,person),
    }
  }

  /// Each side has one kind; only a person or invitation names a person.
  val invValidSides = SIDES.forall(s => {
    val p = _side(customGame,s)
    Set("person","invitation","open","closed","bot").contains(p.kind) and
    (Set("person","invitation").contains(p.kind) == (p.person != ""))
  })
  /// One person cannot control or be promised both sides.
  val invExclusivePeople = customGame.white.person == "" or customGame.black.person == "" or customGame.white.person != customGame.black.person
  /// Readiness belongs only to an accepted person in a configuring or started game.
  val invReadyPeople = customGame.ready.forall(s => SIDES.contains(s) and _side(customGame,s).kind == "person")
  /// A started game has exactly two participants, never an invitation or open place.
  val invCompleteAtStart = customGame.starts == 1 implies SIDES.forall(s => Set("person","bot").contains(_side(customGame,s).kind))
  /// Active people have agreed to their starting choices.
  val invAgreedAtStart = customGame.status == "active" implies customGame.ready == SIDES.filter(s => _side(customGame,s).kind == "person")
  /// A game starts at most once and cannot be active without starting.
  val invOneStart = Set(0,1).contains(customGame.starts) and (customGame.status == "active" implies customGame.starts == 1)
  /// Configuring and absent games have never started; completed games have started.
  val invStartStatus = (customGame.starts == 1 implies Set("active","completed","cancelled").contains(customGame.status)) and (customGame.status == "completed" implies customGame.starts == 1)
  /// Starting choices are immutable; cancelling only clears readiness.
  val invStartingChoicesFrozen = customGame.starts == 1 implies _config(customGame) == _frozen
  /// Terminal games stay terminal until a separate game is created.
  val invTerminalStaysTerminal = _sealed implies _terminal(customGame)
  /// Only a terminal game has an outcome.
  val invOutcomeOnlyAtEnd = _terminal(customGame) == (customGame.outcome != "")
  /// The space host is the creator, whether participating or watching.
  val invCreatorAuthority = customGame.status == "none" or customGame.creator == "alice"
  /// Draw offers belong to a participating person in an active game.
  val invDrawOffer = customGame.drawOfferedBy != "" implies customGame.status == "active" and _personSide(customGame,customGame.drawOfferedBy) != ""
  /// Connected people see the same game. Offline pictures remain legal games.
  val invConnectedAgree = DEVICES.forall(p => _offline.contains(p) or gameShown.get(p) == (if (_members.contains(_personOf(p)) and not(_signedOut.contains(p))) customGame else _INITIAL))
  /// Every refusal names one defined reason, including loss of connection.
  pure val _REASONS = Set("","not in the space","only the creator","no finished game","finish or cancel first","no Custom Game","finished","cancelled","already started","one side per person","person not in the space","not your invitation","no invitation","not an open place","not your side","not a participant","invalid time choice","both sides need participants","every person must be ready","not started","not the other participant","draw agreement needs two people","connection needed","choices changed")
  val invRefusalsDefined = refusal.keys() == DEVICES and DEVICES.forall(p => _REASONS.contains(refusal.get(p)))
  /// Choices stay in their admitted time and increment ranges.
  val invClockChoices = TIMES.contains(customGame.minutes) and INCREMENTS.contains(customGame.increment) and (customGame.minutes == 0 implies customGame.increment == 0)
  /// An offline person keeps their last picture during remote choices.
  val invOfflineKeepsPicture = DEVICES.forall(p => _offline.contains(p) implies statusShown.get(p) == _cutOffStatus.get(p) and creatorShown.get(p) == _cutOffCreator.get(p) and whiteShown.get(p) == _cutOffWhite.get(p) and blackShown.get(p) == _cutOffBlack.get(p) and readyShown.get(p) == _cutOffReady.get(p) and minutesShown.get(p) == _cutOffMinutes.get(p) and incrementShown.get(p) == _cutOffIncrement.get(p) and startsShown.get(p) == _cutOffStarts.get(p) and outcomeShown.get(p) == _cutOffOutcome.get(p) and drawOfferedByShown.get(p) == _cutOffDrawofferedby.get(p))
  /// Only people still in the space hold a waiting side or invitation.
  val invWaitingPeopleBelong = customGame.status == "configuring" implies SIDES.forall(s => _side(customGame,s).person == "" or _members.contains(_side(customGame,s).person))

  pure val _PARTICIPANTS = Set(_EMPTY,_CLOSED,_BOT).union(PEOPLE.map(p => {kind: "person", person: p})).union(PEOPLE.map(p => {kind: "invitation", person: p}))
  pure val _PARTICIPANT_PAIRS = tuples(_PARTICIPANTS,_PARTICIPANTS)
  pure val _TIME_PAIRS = tuples(TIMES,INCREMENTS)
  // These promises survive any number of choices, departures and returns.
  val _inductive = all {
    status.in(Set("none","configuring","active","completed","cancelled")),
    statusShown.in(DEVICES.setOfMaps(Set("none","configuring","active","completed","cancelled"))),
    _cutOffStatus.in(DEVICES.setOfMaps(Set("none","configuring","active","completed","cancelled"))),
    creator.in(Set("","alice")),
    creatorShown.in(DEVICES.setOfMaps(Set("","alice"))),
    _cutOffCreator.in(DEVICES.setOfMaps(Set("","alice"))),
    white.in(_PARTICIPANTS),
    whiteShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffWhite.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    black.in(_PARTICIPANTS),
    blackShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffBlack.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    ready.in(SIDES.powerset()),
    readyShown.in(DEVICES.setOfMaps(SIDES.powerset())),
    _cutOffReady.in(DEVICES.setOfMaps(SIDES.powerset())),
    minutes.in(TIMES),
    minutesShown.in(DEVICES.setOfMaps(TIMES)),
    _cutOffMinutes.in(DEVICES.setOfMaps(TIMES)),
    increment.in(INCREMENTS),
    incrementShown.in(DEVICES.setOfMaps(INCREMENTS)),
    _cutOffIncrement.in(DEVICES.setOfMaps(INCREMENTS)),
    starts.in(Set(0,1)),
    startsShown.in(DEVICES.setOfMaps(Set(0,1))),
    _cutOffStarts.in(DEVICES.setOfMaps(Set(0,1))),
    outcome.in(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time")),
    outcomeShown.in(DEVICES.setOfMaps(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time"))),
    _cutOffOutcome.in(DEVICES.setOfMaps(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time"))),
    drawOfferedBy.in(PEOPLE.union(Set(""))),
    drawOfferedByShown.in(DEVICES.setOfMaps(PEOPLE.union(Set("")))),
    _cutOffDrawofferedby.in(DEVICES.setOfMaps(PEOPLE.union(Set("")))),
    refusal.in(DEVICES.setOfMaps(_REASONS)),
    _offline.in(DEVICES.powerset()), _members.in(PEOPLE.powerset()), _signedOut.in(DEVICES.powerset()),
    _frozen.in(tuples(_PARTICIPANTS,_PARTICIPANTS,TIMES,INCREMENTS)),
    _sealed.in(Set(false,true)), _spaceEnded.in(Set(false,true)),
    _spaceEnded == not(_members.contains("alice")),
    _sealed == _terminal(customGame),
    customGame.status == "none" implies customGame == _INITIAL,
    invValidSides, invExclusivePeople, invReadyPeople, invCompleteAtStart,
    invOneStart, invStartStatus, invStartingChoicesFrozen, invTerminalStaysTerminal,
    invOutcomeOnlyAtEnd, invCreatorAuthority, invDrawOffer, invConnectedAgree,
    invRefusalsDefined, invClockChoices, invOfflineKeepsPicture,
    invWaitingPeopleBelong, invAgreedAtStart,
  }
}
