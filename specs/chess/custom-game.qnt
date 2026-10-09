// A Custom Game belongs to the host of its space. White and Black may be
// people, bots, invitations, open places or closed sides while configuring.
// People choose whether to accept and become ready. The creator may watch.
// A start fixes the participants and choices. A finished or cancelled game
// stays that way; a new game or rematch is a separate Custom Game.
// Choices with other people need the host to be online. Offline guests keep
// their last picture and see the current game when the host is available again.
// The host can make their own solo choices offline and keep playing alone.
// Here shared choices are made online; refused solo choices are also checked.
// The host's accepted offline choices and play have their own local game rules.
// An acknowledged choice survives closing the app.
// Simultaneous choices may succeed in either order; an earlier choice cannot
// overwrite a newer one. Chess endings finish the same game; chess moves and
// clocks are governed by chess, rather than a second set of move rules here;
// this model only notes which sides have moved. Either participant of a game
// between two people may cancel it until each side has moved; afterwards they
// resign instead. Someone whose draw offer was declined offers again only
// after their next move. The creator cannot invite, and nobody can claim a
// side, across a block with the creator; a block never ends a game under way.
// Each person's board faces their own accepted side; everyone else's faces White.
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
  pure val _INITIAL: CustomGame = {
    status: "none", creator: "", white: _EMPTY, black: _EMPTY,
    ready: Set(), minutes: 0, increment: 0, starts: 0,
    outcome: "", drawOfferedBy: "",
  }
  // Blocks between the creator and someone else; other blocks change nothing here.
  pure val _BLOCK_PAIRS = Set(("alice","bob"),("bob","alice"),("alice","carol"),("carol","alice"))
  pure val _COMMANDS = Set("take", "bot", "open", "close", "invite", "accept", "decline", "revoke", "claim", "release", "ready", "unready", "swap", "clock", "start", "cancel", "resign", "offer", "agree", "reject", "create", "rematch")

  /// The agreed game remains itself when no person can currently see it.
  /// Each person observes their own picture below, including its result and readiness.
  /// Bookkeeping distinguishes separate games whose starting choices happen to match.
  var _gameId: int
  var _gameIdShown: Person -> int
  var _status: str
  var _creator: str
  var _white: Participant
  var _black: Participant
  var _ready: Set[str]
  var _minutes: int
  var _increment: int
  var _starts: int
  var _outcome: str
  var _drawOfferedBy: str
  def customGame = {status: _status, creator: _creator, white: _white, black: _black, ready: _ready, minutes: _minutes, increment: _increment, starts: _starts, outcome: _outcome, drawOfferedBy: _drawOfferedBy}
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
  /// Bookkeeping: moves played in the active game, counted 0, 1, then 2 and 3 alternating;
  /// an even count means White is to move and 2 or more means both sides have moved.
  var _moves: int
  /// Bookkeeping: people whose draw offer was declined and who have not moved since.
  var _declinedOffers: Set[Person]
  /// Bookkeeping: who has blocked whom, as (blocker, blocked person).
  var _blocks: Set[(Person, Person)]
  /// Bookkeeping: whether an invitation or claim ever crossed a block with the creator.
  var _blockIgnored: bool
  /// Each device's board faces its person's accepted side; everyone else's faces White.
  val boardFacing = DEVICES.mapBy(d => if (blackShown.get(d) == {kind: "person", person: _personOf(d)}) "black" else "white")

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
  def _blocked(a: Person, b: Person): bool = _blocks.contains((a,b)) or _blocks.contains((b,a))
  pure def _declinedAfter(g: CustomGame, c: str, declined: Set[Person]): Set[Person] =
    if (c == "reject" and g.drawOfferedBy != "") declined.union(Set(g.drawOfferedBy)) else declined
  def _crossesBlock(c: str, actor: Person, person: Person): bool =
    (c == "invite" and _blocked("alice", person)) or (c == "claim" and _blocked("alice", _personOf(actor)))
  pure def _config(g: CustomGame): (Participant, Participant, int, int) = (g.white, g.black, g.minutes, g.increment)
  pure def _terminal(g: CustomGame): bool = Set("completed", "cancelled").contains(g.status)
  pure def _startable(g: CustomGame): bool = SIDES.forall(s =>
    _side(g,s).kind == "bot" or (_side(g,s).kind == "person" and g.ready.contains(s)))
  pure def _creatorCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "revoke", "swap", "clock", "start", "cancel", "create", "rematch").contains(c)
  pure def _settingCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "accept", "decline", "revoke", "claim", "release", "ready", "unready", "swap", "clock").contains(c)

  def _hostAvailable(offline: Set[Person], signedOut: Set[Person]): bool =
    DEVICES.exists(d => _personOf(d) == "alice" and not(offline.contains(d)) and not(signedOut.contains(d)))
  def _visible(p: Person, members: Set[Person], offline: Set[Person], signedOut: Set[Person]): bool =
    members.contains(_personOf(p)) and not(signedOut.contains(p)) and
      (_personOf(p) == "alice" or _hostAvailable(offline, signedOut))
  pure def _solo(g: CustomGame): bool = SIDES.forall(s =>
    _side(g,s).person == "" or _side(g,s).person == "alice")
  def _choicePicture(actor: Person): CustomGame = if (_offline.contains(actor)) gameShown.get(actor) else customGame
  def _connectionReason(g: CustomGame, actor: Person, command: str): str =
    if (_offline.contains(actor)) {
      if (_personOf(actor) == "alice" and _members.contains("alice") and not(_spaceEnded) and not(_signedOut.contains(actor)) and _solo(g) and command != "invite") ""
      else "connection needed"
    } else if (_members.contains(_personOf(actor)) and not(_signedOut.contains(actor)) and _personOf(actor) != "alice" and not(_hostAvailable(_offline,_signedOut))) "the host is offline"
    else ""

  def _priorityReason(g: CustomGame, actor: Person, c: str): str = {
    val sender = _personOf(actor)
    if (_signedOut.contains(actor) or _spaceEnded or not(_members.contains(sender))) "not in the space"
    else if (g.status == "none" and not(Set("create", "rematch").contains(c))) "no Custom Game"
    else if (_creatorCommand(c) and sender != "alice" and not(c == "cancel" and _personSide(g,sender) != "")) "only the creator"
    else if (Set("create", "rematch").contains(c)) {
      if (g.status == "none" and c == "rematch") "no finished game"
      else if (g.status != "none" and not(_terminal(g))) "finish or cancel first" else ""
    }
    else if (g.status == "completed") "finished"
    else if (g.status == "cancelled") "cancelled"
    else if (_settingCommand(c) and g.status != "configuring") "already started"
    else ""
  }

  def _reason(g: CustomGame, actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): str =
    _reasonWith(g, _declinedOffers, actor, c, side, person, minutes, increment)

  def _reasonWith(g: CustomGame, declined: Set[Person], actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): str = {
    val sender = _personOf(actor)
    val occupied = _side(g, side)
    val priority = _priorityReason(g,actor,c)
    if (priority != "" or Set("create", "rematch").contains(c)) priority
    else if (c == "take" and _reserved(g, sender) and occupied.person != sender) "one side per person"
    else if (c == "invite" and not(_members.contains(person))) "person not in the space"
    else if (c == "invite" and _blocked("alice", person)) "cannot be invited"
    else if (c == "invite" and _reserved(g, person) and occupied.person != person) "one side per person"
    else if (Set("accept", "decline").contains(c) and (occupied.kind != "invitation" or occupied.person != sender)) "not your invitation"
    else if (c == "revoke" and occupied.kind != "invitation") "no invitation"
    else if (c == "claim" and _blocked("alice", sender)) "side not available"
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
    else if (c == "offer" and declined.contains(sender)) "offer again after moving"
    else if (c == "cancel" and sender != "alice" and (g.status != "active" or g.white.kind != "person" or g.black.kind != "person")) "only the creator"
    else if (c == "cancel" and sender != "alice" and _moves >= 2) "resign instead"
    else ""
  }

  def _inherited(p: Participant): Participant =
    if (p.kind == "bot" or (p.kind == "person" and _members.contains(p.person))) p else _EMPTY

  // An allowed choice changes the game after its reason has been checked.
  def _next(g: CustomGame, actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): CustomGame =
    if (c == "create") { ..._INITIAL, status: "configuring", creator: _personOf(actor), white: {kind: "person", person: _personOf(actor)} }
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

  action _update(g: CustomGame, offline: Set[Person], members: Set[Person], signedOut: Set[Person], reasons: Person -> str, fresh: bool): bool =
    _updateAll(g, offline, members, signedOut, reasons, fresh, _moves, _declinedOffers, _blocks, _blockIgnored)

  action _updateAll(g: CustomGame, offline: Set[Person], members: Set[Person], signedOut: Set[Person], reasons: Person -> str, fresh: bool, moves: int, declined: Set[Person], blocks: Set[(Person, Person)], blockIgnored: bool): bool = all {
    _moves' = if (g.status == "active") moves else 0,
    _declinedOffers' = if (g.status == "active") declined else Set(),
    _blocks' = blocks,
    _blockIgnored' = blockIgnored,
    _gameId' = if (fresh) _gameId + 1 else _gameId,
    _gameIdShown' = DEVICES.mapBy(p => if (offline.contains(p)) _gameIdShown.get(p) else if (_visible(p,members,offline,signedOut)) (if (fresh) _gameId + 1 else _gameId) else 0),
    _status' = g.status,
    _creator' = g.creator,
    _white' = g.white,
    _black' = g.black,
    _ready' = g.ready,
    _minutes' = g.minutes,
    _increment' = g.increment,
    _starts' = g.starts,
    _outcome' = g.outcome,
    _drawOfferedBy' = g.drawOfferedBy,
    _offline' = offline,
    _signedOut' = signedOut,
    refusal' = reasons,
    statusShown' = DEVICES.mapBy(p => if (offline.contains(p)) statusShown.get(p) else if (_visible(p,members,offline,signedOut)) g.status else _INITIAL.status),
    creatorShown' = DEVICES.mapBy(p => if (offline.contains(p)) creatorShown.get(p) else if (_visible(p,members,offline,signedOut)) g.creator else _INITIAL.creator),
    whiteShown' = DEVICES.mapBy(p => if (offline.contains(p)) whiteShown.get(p) else if (_visible(p,members,offline,signedOut)) g.white else _INITIAL.white),
    blackShown' = DEVICES.mapBy(p => if (offline.contains(p)) blackShown.get(p) else if (_visible(p,members,offline,signedOut)) g.black else _INITIAL.black),
    readyShown' = DEVICES.mapBy(p => if (offline.contains(p)) readyShown.get(p) else if (_visible(p,members,offline,signedOut)) g.ready else _INITIAL.ready),
    minutesShown' = DEVICES.mapBy(p => if (offline.contains(p)) minutesShown.get(p) else if (_visible(p,members,offline,signedOut)) g.minutes else _INITIAL.minutes),
    incrementShown' = DEVICES.mapBy(p => if (offline.contains(p)) incrementShown.get(p) else if (_visible(p,members,offline,signedOut)) g.increment else _INITIAL.increment),
    startsShown' = DEVICES.mapBy(p => if (offline.contains(p)) startsShown.get(p) else if (_visible(p,members,offline,signedOut)) g.starts else _INITIAL.starts),
    outcomeShown' = DEVICES.mapBy(p => if (offline.contains(p)) outcomeShown.get(p) else if (_visible(p,members,offline,signedOut)) g.outcome else _INITIAL.outcome),
    drawOfferedByShown' = DEVICES.mapBy(p => if (offline.contains(p)) drawOfferedByShown.get(p) else if (_visible(p,members,offline,signedOut)) g.drawOfferedBy else _INITIAL.drawOfferedBy),
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

  // Accepted choices have already met their connection and refusal rules.
  action _acceptChoice(actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): bool = {
    val changed = _next(customGame,actor,c,side,person,minutes,increment)
    _updateAll(changed,_offline,_members,_signedOut,refusal.set(actor,""), changed != customGame and Set("create","rematch").contains(c),
      _moves, _declinedAfter(customGame,c,_declinedOffers), _blocks, _blockIgnored or _crossesBlock(c,actor,person))
  }

  pure val _BEGIN = {..._INITIAL, status: "configuring", creator: "alice", white: {kind: "person", person: "alice"}}
  action init = {
    nondet beginning = Set("choices","people","bots","playing","offering","empty").oneOf()
    nondet blocks = Set(Set(), Set(("alice","carol")), Set(("carol","alice"))).oneOf()
    val people = {..._BEGIN, black: {kind: "person", person: "bob"}, ready: SIDES}
    val g = if (beginning == "empty") _INITIAL
      else if (beginning == "people") people
      else if (beginning == "bots") {..._BEGIN, white: _BOT, black: _BOT}
      else if (beginning == "playing" or beginning == "offering") {...people, status: "active", starts: 1, drawOfferedBy: if(beginning == "offering") "alice" else ""}
      else _BEGIN
    all {
      _gameId' = if (g.status == "none") 0 else 1,
      _gameIdShown' = DEVICES.mapBy(p => if (p == "carol" or g.status == "none") 0 else 1),
      _status' = g.status,
    _creator' = g.creator,
    _white' = g.white,
    _black' = g.black,
    _ready' = g.ready,
    _minutes' = g.minutes,
    _increment' = g.increment,
    _starts' = g.starts,
    _outcome' = g.outcome,
    _drawOfferedBy' = g.drawOfferedBy,
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
      _moves' = 0, _declinedOffers' = Set(), _blocks' = blocks, _blockIgnored' = false,
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
  action createGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"create") == "", _reason(customGame,actor,"create","white",actor,0,0) == "", _acceptChoice(actor,"create","white",actor,0,0) }

  /// A person creates a rematch for the same Custom Game, or hears why it is refused.
  action rematch(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"rematch") == "", _reason(customGame,actor,"rematch","white",actor,0,0) == "", _acceptChoice(actor,"rematch","white",actor,0,0) }

  /// A person takes a side for the same Custom Game, or hears why it is refused.
  action takeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"take") == "", _reason(customGame,actor,"take",side,actor,0,0) == "", _acceptChoice(actor,"take",side,actor,0,0) }

  /// A person assigns a bot for the same Custom Game, or hears why it is refused.
  action assignBot(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"bot") == "", _reason(customGame,actor,"bot",side,actor,0,0) == "", _acceptChoice(actor,"bot",side,actor,0,0) }

  /// A person opens a side for the same Custom Game, or hears why it is refused.
  action openSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"open") == "", _reason(customGame,actor,"open",side,actor,0,0) == "", _acceptChoice(actor,"open",side,actor,0,0) }

  /// A person closes a side for the same Custom Game, or hears why it is refused.
  action closeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"close") == "", _reason(customGame,actor,"close",side,actor,0,0) == "", _acceptChoice(actor,"close",side,actor,0,0) }

  /// A person invites another person for the same Custom Game, or hears why it is refused.
  action invite(actor: Person, side: Side, person: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"invite") == "", _reason(customGame,actor,"invite",side,person,0,0) == "", _acceptChoice(actor,"invite",side,person,0,0) }

  /// A person accepts an invitation for the same Custom Game, or hears why it is refused.
  action acceptSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"accept") == "", _reason(customGame,actor,"accept",side,actor,0,0) == "", _acceptChoice(actor,"accept",side,actor,0,0) }

  /// A person declines an invitation for the same Custom Game, or hears why it is refused.
  action declineSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"decline") == "", _reason(customGame,actor,"decline",side,actor,0,0) == "", _acceptChoice(actor,"decline",side,actor,0,0) }

  /// A person revokes an invitation for the same Custom Game, or hears why it is refused.
  action revokeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"revoke") == "", _reason(customGame,actor,"revoke",side,actor,0,0) == "", _acceptChoice(actor,"revoke",side,actor,0,0) }

  /// A person claims an open place for the same Custom Game, or hears why it is refused.
  action claimSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"claim") == "", _reason(customGame,actor,"claim",side,actor,0,0) == "", _acceptChoice(actor,"claim",side,actor,0,0) }

  /// A person releases their side for the same Custom Game, or hears why it is refused.
  action releaseSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"release") == "", _reason(customGame,actor,"release",side,actor,0,0) == "", _acceptChoice(actor,"release",side,actor,0,0) }

  /// A person becomes ready for the same Custom Game, or hears why it is refused.
  action becomeReady(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"ready") == "", _reason(customGame,actor,"ready","white",actor,0,0) == "", _acceptChoice(actor,"ready","white",actor,0,0) }

  /// A person withdraws readiness for the same Custom Game, or hears why it is refused.
  action becomeUnready(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"unready") == "", _reason(customGame,actor,"unready","white",actor,0,0) == "", _acceptChoice(actor,"unready","white",actor,0,0) }

  /// A person swaps the sides for the same Custom Game, or hears why it is refused.
  action swapSides(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"swap") == "", _reason(customGame,actor,"swap","white",actor,0,0) == "", _acceptChoice(actor,"swap","white",actor,0,0) }

  /// A person chooses the time for the same Custom Game, or hears why it is refused.
  action chooseClock(actor: Person, minutes: int, increment: int): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"clock") == "", _reason(customGame,actor,"clock","white",actor,minutes,increment) == "", _acceptChoice(actor,"clock","white",actor,minutes,increment) }

  /// A person starts the game for the same Custom Game, or hears why it is refused.
  action startGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"start") == "", _reason(customGame,actor,"start","white",actor,0,0) == "", _acceptChoice(actor,"start","white",actor,0,0) }

  /// A person cancels the game for the same Custom Game, or hears why it is refused.
  action cancelGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"cancel") == "", _reason(customGame,actor,"cancel","white",actor,0,0) == "", _acceptChoice(actor,"cancel","white",actor,0,0) }

  /// A person resigns the game for the same Custom Game, or hears why it is refused.
  action resignGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"resign") == "", _reason(customGame,actor,"resign","white",actor,0,0) == "", _acceptChoice(actor,"resign","white",actor,0,0) }

  /// A person offers a draw for the same Custom Game, or hears why it is refused.
  action offerDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"offer") == "", _reason(customGame,actor,"offer","white",actor,0,0) == "", _acceptChoice(actor,"offer","white",actor,0,0) }

  /// A person accepts a draw for the same Custom Game, or hears why it is refused.
  action acceptDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"agree") == "", _reason(customGame,actor,"agree","white",actor,0,0) == "", _acceptChoice(actor,"agree","white",actor,0,0) }

  /// A person declines a draw for the same Custom Game, or hears why it is refused.
  action declineDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"reject") == "", _reason(customGame,actor,"reject","white",actor,0,0) == "", _acceptChoice(actor,"reject","white",actor,0,0) }

  def _connectedPerson(person: Person): bool = _members.contains(person) and DEVICES.exists(device =>
    _personOf(device) == person and not(_offline.contains(device)) and _visible(device,_members,_offline,_signedOut))
  /// A chess ending finishes an active game without changing its choices.
  /// People playing the ending need a signed-in device with a connection.
  /// White must play before Black's clock can run out from the starting board;
  /// a running clock never waits for either person to return.
  action _finishGame(result: str): bool = all {
    customGame.status == "active",
    customGame.white.kind == "person", customGame.black.kind == "person",
    customGame.minutes > 0 or Set("white wins by checkmate", "black wins by checkmate", "draw").contains(result),
    Set("white wins by checkmate", "black wins by checkmate", "draw").contains(result) implies SIDES.forall(side => _connectedPerson(_side(customGame,side).person)),
    result == "white wins on time" implies _connectedPerson(customGame.white.person),
    _update({...customGame, status: "completed", outcome: result, drawOfferedBy: ""}, _offline, _members,_signedOut, refusal, false),
  }
  /// A participant or bot plays a legal move for the side to move, White first and
  /// then in turn; chess decides which move. A move clears a
  /// waiting draw offer and lets the mover offer a draw again.
  action _sideMoves(side: Side): bool = {
    val mover = _side(customGame,side)
    all {
      customGame.status == "active",
      side == (if (_moves % 2 == 0) "white" else "black"),
      mover.kind == "bot" or (mover.kind == "person" and _connectedPerson(mover.person)),
      _updateAll({...customGame, drawOfferedBy: ""},_offline,_members,_signedOut,refusal,false,
        if (_moves < 3) _moves + 1 else 2,_declinedOffers.exclude(Set(mover.person)),_blocks,_blockIgnored),
    }
  }
  /// Someone blocks another person. A block changes no side and never ends a game under way.
  action _personBlocks(blocker: Person, blocked: Person): bool = all {
    _BLOCK_PAIRS.contains((blocker,blocked)),
    _updateAll(customGame,_offline,_members,_signedOut,refusal,false,_moves,_declinedOffers,_blocks.union(Set((blocker,blocked))),_blockIgnored),
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
  /// Earlier choices never replace the agreed game. A person first hears
  /// why they cannot make that choice, or otherwise that the choices changed.
  action _staleChoice(actor: Person, command: str): bool = {
    val picture = _choicePicture(actor)
    val priority = _priorityReason(picture,actor,command)
    val connection = _connectionReason(picture,actor,command)
    val reason = if (connection != "") connection
      else if (priority != "") priority
      else "choices changed"
    all {
      customGame.status != "none",
      _update(customGame,_offline,_members,_signedOut,refusal.set(actor,reason),false),
    }
  }
  /// Two choices made together may be accepted in either order. A choice
  /// that changed the participants or time stops the other from using earlier choices.
  /// Readiness and starting do not replace those choices; each ready person
  /// can agree, and two starts keep the same game.
  action _competingChoices(actor: Person, other: Person, command: str, otherCommand: str, side: Side, otherSide: Side, person: Person): bool = {
    val referenceDevice = if (not(_offline.contains(actor)) and _visible(actor,_members,_offline,_signedOut)) actor else other
    val reference = gameShown.get(referenceDevice)
    val referenceId = _gameIdShown.get(referenceDevice)
    val picture = _choicePicture(actor)
    val pictureId = if (_offline.contains(actor)) _gameIdShown.get(actor) else _gameId
    val firstPriority = _priorityReason(picture,actor,command)
    val connection = _connectionReason(picture,actor,command)
    val firstEarlier = pictureId != referenceId or
      ((_settingCommand(command) or Set("start","cancel").contains(command)) and _config(picture) != _config(reference))
    val firstReason = if (connection != "") connection else if (firstPriority != "") firstPriority else if (firstEarlier) "choices changed" else _reason(picture,actor,command,side,person,1,0)
    val first = if (firstReason != "") customGame else _next(customGame,actor,command,side,person,1,0)
    val firstFresh = first != customGame and Set("create","rematch").contains(command)
    val firstDeclined = if (firstReason != "") _declinedOffers else _declinedAfter(customGame,command,_declinedOffers)
    val otherPicture = if (_offline.contains(other)) gameShown.get(other) else first
    val otherPictureId = if (_offline.contains(other)) _gameIdShown.get(other) else _gameId + (if (firstFresh) 1 else 0)
    val priority = _priorityReason(otherPicture,other,otherCommand)
    val choicesChanged = otherPictureId != referenceId or
      ((_settingCommand(otherCommand) or Set("start","cancel").contains(otherCommand)) and _config(otherPicture) != _config(reference))
    val otherConnection = _connectionReason(otherPicture,other,otherCommand)
    val secondReason = if (otherConnection != "") otherConnection else if(priority != "") priority else if (choicesChanged) "choices changed" else _reasonWith(otherPicture,firstDeclined,other,otherCommand,otherSide,person,1,0)
    val second = if (secondReason != "") first else _next(first,other,otherCommand,otherSide,person,1,0)
    val secondDeclined = if (secondReason != "") firstDeclined else _declinedAfter(first,otherCommand,firstDeclined)
    val crossed = (firstReason == "" and _crossesBlock(command,actor,person)) or (secondReason == "" and _crossesBlock(otherCommand,other,person))
    val fresh = (first != customGame and Set("create","rematch").contains(command)) or (second != first and Set("create","rematch").contains(otherCommand))
    // Shared choices are agreed online. An offline solo choice which succeeds
    // belongs to the host's local game; it never changes another device here.
    all {
      _offline.contains(actor) implies firstReason != "",
      _offline.contains(other) implies secondReason != "",
      _updateAll(second,_offline,_members,_signedOut,refusal.set(actor,firstReason).set(other,secondReason),fresh,
        _moves,secondDeclined,_blocks,_blockIgnored or crossed),
    }
  }

  /// Every expressible refused choice leaves the agreed game intact.
  action _attemptChoice(actor: Person, command: str, side: Side, person: Person): bool = {
    val picture = _choicePicture(actor)
    val connection = _connectionReason(picture,actor,command)
    val reason = if (connection != "") connection else _reason(picture,actor,command,side,person,1,0)
    all {
      reason != "",
      _update(customGame,_offline,_members,_signedOut,refusal.set(actor,reason),false),
    }
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
  /// While its host is offline, the person is told why joining is unavailable.
  action _personJoins(actor: Person): bool = all {
    not(_spaceEnded), not(_members.contains(_personOf(actor))), not(_offline.contains(actor)),
    val available = _hostAvailable(_offline,_signedOut)
    _update(customGame,_offline,if (available) _members.union(Set(_personOf(actor))) else _members,
      _signedOut,refusal.set(actor,if (available) "" else "the host is offline"),false),
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
      _finishGame(result), _sideMoves(side), _personBlocks(_personOf(actor), person), _loseConnection(actor), _connectionReturns(actor),
      _signOut(actor), _signIn(actor), _usernameChanges(actor), _personLeaves(actor), _personJoins(actor), _reopenApp(actor), _repeatAcknowledged, _staleChoice(actor,command), _attemptChoice(actor,command,side,person),
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
  /// Guests see the agreed game only while a signed-in host device is online.
  /// An offline guest retains the picture they last knew.
  val invConnectedAgree = DEVICES.forall(p => _offline.contains(p) or gameShown.get(p) == (if (_visible(p,_members,_offline,_signedOut)) customGame else _INITIAL))
  /// Every refusal names one defined reason, including loss of connection.
  pure val _REASONS = Set("","not in the space","only the creator","no finished game","finish or cancel first","no Custom Game","finished","cancelled","already started","one side per person","person not in the space","not your invitation","no invitation","not an open place","not your side","not a participant","invalid time choice","both sides need participants","every person must be ready","not started","not the other participant","draw agreement needs two people","connection needed","the host is offline","choices changed","resign instead","offer again after moving","cannot be invited","side not available")
  val invRefusalsDefined = refusal.keys() == DEVICES and DEVICES.forall(p => _REASONS.contains(refusal.get(p)))
  /// Choices stay in their admitted time and increment ranges.
  val invClockChoices = TIMES.contains(customGame.minutes) and INCREMENTS.contains(customGame.increment) and (customGame.minutes == 0 implies customGame.increment == 0)
  /// An offline person keeps their last picture during remote choices.
  val invOfflineKeepsPicture = DEVICES.forall(p => _offline.contains(p) implies statusShown.get(p) == _cutOffStatus.get(p) and creatorShown.get(p) == _cutOffCreator.get(p) and whiteShown.get(p) == _cutOffWhite.get(p) and blackShown.get(p) == _cutOffBlack.get(p) and readyShown.get(p) == _cutOffReady.get(p) and minutesShown.get(p) == _cutOffMinutes.get(p) and incrementShown.get(p) == _cutOffIncrement.get(p) and startsShown.get(p) == _cutOffStarts.get(p) and outcomeShown.get(p) == _cutOffOutcome.get(p) and drawOfferedByShown.get(p) == _cutOffDrawofferedby.get(p))
  /// Moves and declined draw offers belong only to an active game.
  val invMovesOnlyWhileActive = (_moves != 0 or _declinedOffers != Set()) implies customGame.status == "active"
  /// Someone whose draw offer was declined cannot offer again before moving.
  val invNoRepeatedOffer = customGame.drawOfferedBy == "" or not(_declinedOffers.contains(customGame.drawOfferedBy))
  /// No invitation or claim ever crosses a block with the creator.
  val invBlocksRespected = not(_blockIgnored)
  /// Each connected person's board faces their own accepted side; everyone else's faces White.
  val invBoardFacesOwnSide = DEVICES.forall(d =>
    (not(_offline.contains(d)) and _visible(d,_members,_offline,_signedOut)) implies
      boardFacing.get(d) == (if (_personSide(customGame,_personOf(d)) == "black") "black" else "white"))
  /// Only people still in the space hold a waiting side or invitation.
  val invWaitingPeopleBelong = customGame.status == "configuring" implies SIDES.forall(s => _side(customGame,s).person == "" or _members.contains(_side(customGame,s).person))

  pure val _PARTICIPANTS = Set(_EMPTY,_CLOSED,_BOT).union(PEOPLE.map(p => {kind: "person", person: p})).union(PEOPLE.map(p => {kind: "invitation", person: p}))
  pure val _PARTICIPANT_PAIRS = tuples(_PARTICIPANTS,_PARTICIPANTS)
  pure val _TIME_PAIRS = tuples(TIMES,INCREMENTS)
  // These promises survive any number of choices, departures and returns.
  val _inductive = all {
    _gameId.in(Nat),
    _gameIdShown.in(DEVICES.setOfMaps(Nat)),
    _status.in(Set("none","configuring","active","completed","cancelled")),
    statusShown.in(DEVICES.setOfMaps(Set("none","configuring","active","completed","cancelled"))),
    _cutOffStatus.in(DEVICES.setOfMaps(Set("none","configuring","active","completed","cancelled"))),
    _creator.in(Set("","alice")),
    creatorShown.in(DEVICES.setOfMaps(Set("","alice"))),
    _cutOffCreator.in(DEVICES.setOfMaps(Set("","alice"))),
    _white.in(_PARTICIPANTS),
    whiteShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffWhite.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _black.in(_PARTICIPANTS),
    blackShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffBlack.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _ready.in(SIDES.powerset()),
    readyShown.in(DEVICES.setOfMaps(SIDES.powerset())),
    _cutOffReady.in(DEVICES.setOfMaps(SIDES.powerset())),
    _minutes.in(TIMES),
    minutesShown.in(DEVICES.setOfMaps(TIMES)),
    _cutOffMinutes.in(DEVICES.setOfMaps(TIMES)),
    _increment.in(INCREMENTS),
    incrementShown.in(DEVICES.setOfMaps(INCREMENTS)),
    _cutOffIncrement.in(DEVICES.setOfMaps(INCREMENTS)),
    _starts.in(Set(0,1)),
    startsShown.in(DEVICES.setOfMaps(Set(0,1))),
    _cutOffStarts.in(DEVICES.setOfMaps(Set(0,1))),
    _outcome.in(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time")),
    outcomeShown.in(DEVICES.setOfMaps(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time"))),
    _cutOffOutcome.in(DEVICES.setOfMaps(Set("","cancelled","draw","white wins by resignation","black wins by resignation","white wins by checkmate","black wins by checkmate","white wins on time","black wins on time"))),
    _drawOfferedBy.in(PEOPLE.union(Set(""))),
    drawOfferedByShown.in(DEVICES.setOfMaps(PEOPLE.union(Set("")))),
    _cutOffDrawofferedby.in(DEVICES.setOfMaps(PEOPLE.union(Set("")))),
    refusal.in(DEVICES.setOfMaps(_REASONS)),
    _offline.in(DEVICES.powerset()), _members.in(PEOPLE.powerset()), _signedOut.in(DEVICES.powerset()),
    _frozen.in(tuples(_PARTICIPANTS,_PARTICIPANTS,TIMES,INCREMENTS)),
    _sealed.in(Set(false,true)), _spaceEnded.in(Set(false,true)),
    _moves.in(0.to(3)), _declinedOffers.in(PEOPLE.powerset()),
    _blocks.in(_BLOCK_PAIRS.powerset()), _blockIgnored.in(Set(false,true)),
    DEVICES.forall(p => _gameIdShown.get(p) <= _gameId),
    DEVICES.forall(p => not(_offline.contains(p)) implies _gameIdShown.get(p) == (if (_visible(p,_members,_offline,_signedOut)) _gameId else 0)),
    (_status == "none") == (_gameId == 0),
    _spaceEnded == not(_members.contains("alice")),
    _sealed == _terminal(customGame),
    customGame.status == "none" implies customGame == _INITIAL,
    invValidSides, invExclusivePeople, invReadyPeople, invCompleteAtStart,
    invOneStart, invStartStatus, invStartingChoicesFrozen, invTerminalStaysTerminal,
    invOutcomeOnlyAtEnd, invCreatorAuthority, invDrawOffer, invConnectedAgree,
    invRefusalsDefined, invClockChoices, invOfflineKeepsPicture,
    invWaitingPeopleBelong, invAgreedAtStart,
    invMovesOnlyWhileActive, invNoRepeatedOffer, invBlocksRespected, invBoardFacesOwnSide,
  }
}
