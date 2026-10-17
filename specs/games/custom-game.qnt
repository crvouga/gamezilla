// A custom game belongs to the host of its space. While it is set up, each
// of its first and second side may be a person, a bot, an invitation, an open
// side or a closed side. People choose whether to accept and become ready.
// The creator may watch. A start fixes the participants and choices. A
// finished or cancelled custom game stays that way; a new custom game or a
// rematch is a separate custom game.
// Choices with other people need the host to be connected. People who still
// have a connection keep seeing the custom game while the host has none or
// is signed out. Guests with no connection keep their last picture.
// A person's own missing connection is named before any other reason.
// A choice only the creator may make keeps that reason while the host has no
// connection. The host can make their own choices alone with no connection
// and keep playing alone. Here choices with other people are made connected;
// refused choices made alone are also checked. The host's accepted choices
// and play with no connection have their own rules, in the local model.
// An acknowledged choice survives closing the app.
// Choices made at once may succeed in either order; an earlier choice cannot
// overwrite a newer one. The game's own rules decide its moves and how it is
// won; this model only notes which sides have moved in its first three moves,
// and that the first side can make the winning move by the game's rules.
// Either participant of a custom game between two people may cancel it until
// each side has moved; afterwards they resign instead. Someone whose draw
// offer was declined offers again only after their next move. The creator
// cannot invite, and nobody can claim a side, across a block with the
// creator; a block never ends a custom game under way.
// Each person sees their own accepted side nearest them; everyone else sees
// the first side nearest.
module custom_game {
  type Person = str
  type Side = str
  type Participant = { kind: str, person: str }
  type CustomGame = {
    status: str, creator: str, firstSide: Participant, secondSide: Participant,
    ready: Set[str], minutes: int, increment: int, starts: int,
    result: str, drawOfferedBy: str,
  }
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val DEVICES = PEOPLE.union(Set("alice-other"))
  pure def _personOf(device: str): Person = if(device == "alice-other") "alice" else device
  pure val SIDES = Set("first", "second")
  // Untimed and two different timed choices cover choice changes. The full
  // admitted ranges and their boundaries are illustrated in the clock rules.
  pure val TIMES = Set(0, 1, 5)
  pure val INCREMENTS = Set(0, 2)
  pure val _EMPTY = { kind: "open", person: "" }
  pure val _BOT = { kind: "bot", person: "" }
  pure val _CLOSED = { kind: "closed", person: "" }
  pure val _INITIAL: CustomGame = {
    status: "none", creator: "", firstSide: _EMPTY, secondSide: _EMPTY,
    ready: Set(), minutes: 0, increment: 0, starts: 0,
    result: "", drawOfferedBy: "",
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
  var _firstSide: Participant
  var _secondSide: Participant
  var _ready: Set[str]
  var _minutes: int
  var _increment: int
  var _starts: int
  var _result: str
  var _drawOfferedBy: str
  def customGame = {status: _status, creator: _creator, firstSide: _firstSide, secondSide: _secondSide, ready: _ready, minutes: _minutes, increment: _increment, starts: _starts, result: _result, drawOfferedBy: _drawOfferedBy}
  /// Each person's last picture of the custom game.
  var statusShown: Person -> str
  var creatorShown: Person -> str
  var firstSideShown: Person -> Participant
  var secondSideShown: Person -> Participant
  var readyShown: Person -> Set[str]
  var minutesShown: Person -> int
  var incrementShown: Person -> int
  var startsShown: Person -> int
  var resultShown: Person -> str
  var drawOfferedByShown: Person -> str
  val gameShown = DEVICES.mapBy(p => {status: statusShown.get(p), creator: creatorShown.get(p), firstSide: firstSideShown.get(p), secondSide: secondSideShown.get(p), ready: readyShown.get(p), minutes: minutesShown.get(p), increment: incrementShown.get(p), starts: startsShown.get(p), result: resultShown.get(p), drawOfferedBy: drawOfferedByShown.get(p)})
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
  var _cutOffFirstSide: Person -> Participant
  var _cutOffSecondSide: Person -> Participant
  var _cutOffReady: Person -> Set[str]
  var _cutOffMinutes: Person -> int
  var _cutOffIncrement: Person -> int
  var _cutOffStarts: Person -> int
  var _cutOffResult: Person -> str
  var _cutOffDrawofferedby: Person -> str
  /// Bookkeeping: moves made in the custom game under way, up to its first three;
  /// an even count means the first side is to move and 2 or more means both sides have moved.
  var _moves: int
  /// Bookkeeping: people whose draw offer was declined and who have not moved since.
  var _declinedOffers: Set[Person]
  /// Bookkeeping: who has blocked whom, as (blocker, blocked person).
  var _blocks: Set[(Person, Person)]
  /// Bookkeeping: whether an invitation or claim ever crossed a block with the creator.
  var _blockIgnored: bool
  /// The side each device shows nearest: its person's own accepted side, otherwise the first side.
  val nearestSide = DEVICES.mapBy(d => if (secondSideShown.get(d) == {kind: "person", person: _personOf(d)}) "second" else "first")

  pure def _side(g: CustomGame, side: Side): Participant = if (side == "first") g.firstSide else g.secondSide
  pure def _other(side: Side): Side = if (side == "first") "second" else "first"
  pure def _personSide(g: CustomGame, person: Person): str =
    if (g.firstSide.kind == "person" and g.firstSide.person == person) "first"
    else if (g.secondSide.kind == "person" and g.secondSide.person == person) "second" else ""
  pure def _reserved(g: CustomGame, person: Person): bool =
    Set("person", "invitation").contains(g.firstSide.kind) and g.firstSide.person == person or
    Set("person", "invitation").contains(g.secondSide.kind) and g.secondSide.person == person
  pure def _replace(g: CustomGame, side: Side, p: Participant): CustomGame =
    if (_side(g, side) == p) g
    else if (side == "first") { ...g, firstSide: p, ready: Set() }
    else { ...g, secondSide: p, ready: Set() }
  def _blocked(a: Person, b: Person): bool = _blocks.contains((a,b)) or _blocks.contains((b,a))
  pure def _declinedAfter(g: CustomGame, c: str, declined: Set[Person]): Set[Person] =
    if (c == "reject" and g.drawOfferedBy != "") declined.union(Set(g.drawOfferedBy)) else declined
  def _crossesBlock(c: str, actor: Person, person: Person): bool =
    (c == "invite" and _blocked("alice", person)) or (c == "claim" and _blocked("alice", _personOf(actor)))
  pure def _config(g: CustomGame): (Participant, Participant, int, int) = (g.firstSide, g.secondSide, g.minutes, g.increment)
  pure def _terminal(g: CustomGame): bool = Set("completed", "cancelled").contains(g.status)
  pure def _startable(g: CustomGame): bool = SIDES.forall(s =>
    _side(g,s).kind == "bot" or (_side(g,s).kind == "person" and g.ready.contains(s)))
  pure def _creatorCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "revoke", "swap", "clock", "start", "cancel", "create", "rematch").contains(c)
  pure def _settingCommand(c: str): bool = Set("take", "bot", "open", "close", "invite", "accept", "decline", "revoke", "claim", "release", "ready", "unready", "swap", "clock").contains(c)

  def _hostAvailable(offline: Set[Person], signedOut: Set[Person]): bool =
    DEVICES.exists(d => _personOf(d) == "alice" and not(offline.contains(d)) and not(signedOut.contains(d)))
  def _visible(p: Person, members: Set[Person], _offline: Set[Person], signedOut: Set[Person]): bool =
    members.contains(_personOf(p)) and not(signedOut.contains(p))
  pure def _solo(g: CustomGame): bool = SIDES.forall(s =>
    _side(g,s).person == "" or _side(g,s).person == "alice")
  def _choicePicture(actor: Person): CustomGame = if (_offline.contains(actor)) gameShown.get(actor) else customGame
  // An offline host has not yet learned that another device ended the space.
  def _localHost(actor: Person, g: CustomGame): bool =
    _personOf(actor) == "alice" and not(_signedOut.contains(actor)) and
      ((_members.contains("alice") and not(_spaceEnded)) or g.creator == "alice")
  def _connectionReason(g: CustomGame, actor: Person, command: str): str =
    if (_offline.contains(actor)) {
      if (_localHost(actor,g) and _solo(g) and command != "invite") ""
      else "connection needed"
    } else if (_members.contains(_personOf(actor)) and not(_signedOut.contains(actor)) and _personOf(actor) != "alice" and not(_hostAvailable(_offline,_signedOut))) "the host is offline"
    else ""

  def _priorityReason(g: CustomGame, actor: Person, c: str): str = {
    val sender = _personOf(actor)
    if (_signedOut.contains(actor) or
      ((_spaceEnded or not(_members.contains(sender))) and not(_offline.contains(actor) and _localHost(actor,g)))) "not in the space"
    else if (g.status == "none" and not(Set("create", "rematch").contains(c))) "no custom game"
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
    else if (c == "clock" and (not(TIMES.contains(minutes)) or not(INCREMENTS.contains(increment)) or (minutes == 0 and increment != 0))) "invalid clock choice"
    else if (c == "start" and g.status == "configuring" and not(SIDES.forall(s => Set("person", "bot").contains(_side(g,s).kind)))) "both sides need participants"
    else if (c == "start" and g.status == "configuring" and not(_startable(g))) "every person must be ready"
    else if (Set("resign", "offer", "agree", "reject").contains(c) and g.status != "active") "not started"
    else if (Set("agree", "reject").contains(c) and (_personSide(g,sender) == "" or g.drawOfferedBy == "" or g.drawOfferedBy == sender)) "not the other participant"
    else if (c == "offer" and (g.firstSide.kind != "person" or g.secondSide.kind != "person")) "draw agreement needs two people"
    else if (c == "offer" and declined.contains(sender)) "offer again after moving"
    else if (c == "cancel" and sender != "alice" and (g.status != "active" or g.firstSide.kind != "person" or g.secondSide.kind != "person")) "only the creator"
    else if (c == "cancel" and sender != "alice" and _moves >= 2) "resign instead"
    else ""
  }

  def _inherited(p: Participant): Participant =
    if (p.kind == "bot" or (p.kind == "person" and _members.contains(p.person))) p else _EMPTY

  // An allowed choice changes the game after its reason has been checked.
  def _next(g: CustomGame, actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): CustomGame =
    if (c == "create") { ..._INITIAL, status: "configuring", creator: _personOf(actor), firstSide: {kind: "person", person: _personOf(actor)} }
    else if (c == "rematch") { ...g, status: "configuring", firstSide: _inherited(g.secondSide), secondSide: _inherited(g.firstSide), ready: Set(), starts: 0, result: "", drawOfferedBy: "" }
    else if (c == "take") _replace(g,side,{kind: "person", person: _personOf(actor)})
    else if (c == "bot") _replace(g,side,_BOT)
    else if (c == "open" or c == "revoke" or c == "decline" or c == "release") _replace(g,side,_EMPTY)
    else if (c == "close") _replace(g,side,_CLOSED)
    else if (c == "invite") _replace(g,side,{kind: "invitation", person: person})
    else if (c == "accept" or c == "claim") _replace(g,side,{kind: "person", person: _personOf(actor)})
    else if (c == "ready") {...g, ready: g.ready.union(Set(_personSide(g,_personOf(actor))))}
    else if (c == "unready") {...g, ready: g.ready.exclude(Set(_personSide(g,_personOf(actor))))}
    else if (c == "swap") {...g, firstSide: g.secondSide, secondSide: g.firstSide, ready: Set()}
    else if (c == "clock") {
      if (g.minutes == minutes and g.increment == increment) g
      else {...g, minutes: minutes, increment: increment, ready: Set()}
    }
    else if (c == "start") {
      if (g.status == "active") g
      else {...g, status: "active", starts: 1}
    }
    else if (c == "cancel") {...g, status: "cancelled", result: "cancelled", drawOfferedBy: "", firstSide: if (g.firstSide.kind == "invitation") _EMPTY else g.firstSide, secondSide: if (g.secondSide.kind == "invitation") _EMPTY else g.secondSide, ready: Set()}
    else if (c == "resign") {...g, status: "completed", result: if (_personSide(g,_personOf(actor)) == "first") "second side wins by resignation" else "first side wins by resignation", drawOfferedBy: ""}
    else if (c == "offer") {...g, drawOfferedBy: _personOf(actor)}
    else if (c == "agree") {...g, status: "completed", result: "draw", drawOfferedBy: ""}
    else if (c == "reject") {...g, drawOfferedBy: ""}
    else g

  action _update(g: CustomGame, offline: Set[Person], members: Set[Person], signedOut: Set[Person], reasons: Person -> str, fresh: bool): bool =
    _updateAll(g, offline, members, signedOut, reasons, fresh, _moves, _declinedOffers, _blocks, _blockIgnored)

  action _updateAll(g: CustomGame, offline: Set[Person], members: Set[Person], signedOut: Set[Person], reasons: Person -> str, fresh: bool, moves: int, declined: Set[Person], blocks: Set[(Person, Person)], blockIgnored: bool): bool = {
    val visible = DEVICES.filter(p => _visible(p,members,offline,signedOut))
    val newlyOffline = offline.exclude(_offline)
    all {
    _moves' = if (g.status == "active") moves else 0,
    _declinedOffers' = if (g.status == "active") declined else Set(),
    _blocks' = blocks,
    _blockIgnored' = blockIgnored,
    _gameId' = if (fresh) _gameId + 1 else _gameId,
    _gameIdShown' = DEVICES.mapBy(p => if (offline.contains(p)) _gameIdShown.get(p) else if (visible.contains(p)) (if (fresh) _gameId + 1 else _gameId) else 0),
    _status' = g.status,
    _creator' = g.creator,
    _firstSide' = g.firstSide,
    _secondSide' = g.secondSide,
    _ready' = g.ready,
    _minutes' = g.minutes,
    _increment' = g.increment,
    _starts' = g.starts,
    _result' = g.result,
    _drawOfferedBy' = g.drawOfferedBy,
    _offline' = offline,
    _signedOut' = signedOut,
    refusal' = reasons,
    statusShown' = DEVICES.mapBy(p => if (offline.contains(p)) statusShown.get(p) else if (visible.contains(p)) g.status else _INITIAL.status),
    creatorShown' = DEVICES.mapBy(p => if (offline.contains(p)) creatorShown.get(p) else if (visible.contains(p)) g.creator else _INITIAL.creator),
    firstSideShown' = DEVICES.mapBy(p => if (offline.contains(p)) firstSideShown.get(p) else if (visible.contains(p)) g.firstSide else _INITIAL.firstSide),
    secondSideShown' = DEVICES.mapBy(p => if (offline.contains(p)) secondSideShown.get(p) else if (visible.contains(p)) g.secondSide else _INITIAL.secondSide),
    readyShown' = DEVICES.mapBy(p => if (offline.contains(p)) readyShown.get(p) else if (visible.contains(p)) g.ready else _INITIAL.ready),
    minutesShown' = DEVICES.mapBy(p => if (offline.contains(p)) minutesShown.get(p) else if (visible.contains(p)) g.minutes else _INITIAL.minutes),
    incrementShown' = DEVICES.mapBy(p => if (offline.contains(p)) incrementShown.get(p) else if (visible.contains(p)) g.increment else _INITIAL.increment),
    startsShown' = DEVICES.mapBy(p => if (offline.contains(p)) startsShown.get(p) else if (visible.contains(p)) g.starts else _INITIAL.starts),
    resultShown' = DEVICES.mapBy(p => if (offline.contains(p)) resultShown.get(p) else if (visible.contains(p)) g.result else _INITIAL.result),
    drawOfferedByShown' = DEVICES.mapBy(p => if (offline.contains(p)) drawOfferedByShown.get(p) else if (visible.contains(p)) g.drawOfferedBy else _INITIAL.drawOfferedBy),
    _frozen' = if (fresh) _config(_INITIAL) else if (g.starts == 1 and customGame.starts == 0) _config(g) else _frozen,
    _sealed' = (if (fresh) false else _sealed or _terminal(g)),
    _members' = members,
    _spaceEnded' = (_spaceEnded or not(members.contains("alice"))),
    _cutOffStatus' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) statusShown.get(p) else _cutOffStatus.get(p)),
    _cutOffCreator' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) creatorShown.get(p) else _cutOffCreator.get(p)),
    _cutOffFirstSide' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) firstSideShown.get(p) else _cutOffFirstSide.get(p)),
    _cutOffSecondSide' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) secondSideShown.get(p) else _cutOffSecondSide.get(p)),
    _cutOffReady' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) readyShown.get(p) else _cutOffReady.get(p)),
    _cutOffMinutes' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) minutesShown.get(p) else _cutOffMinutes.get(p)),
    _cutOffIncrement' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) incrementShown.get(p) else _cutOffIncrement.get(p)),
    _cutOffStarts' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) startsShown.get(p) else _cutOffStarts.get(p)),
    _cutOffResult' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) resultShown.get(p) else _cutOffResult.get(p)),
    _cutOffDrawofferedby' = DEVICES.mapBy(p => if (newlyOffline.contains(p)) drawOfferedByShown.get(p) else _cutOffDrawofferedby.get(p)),
  }
  }

  // Accepted choices have already met their connection and refusal rules.
  action _acceptChoice(actor: Person, c: str, side: Side, person: Person, minutes: int, increment: int): bool = {
    val changed = _next(customGame,actor,c,side,person,minutes,increment)
    _updateAll(changed,_offline,_members,_signedOut,refusal.set(actor,""), changed != customGame and Set("create","rematch").contains(c),
      _moves, _declinedAfter(customGame,c,_declinedOffers), _blocks, _blockIgnored or _crossesBlock(c,actor,person))
  }

  pure val _BEGIN = {..._INITIAL, status: "configuring", creator: "alice", firstSide: {kind: "person", person: "alice"}}
  action init = {
    nondet beginning = Set("choices","people","bots","playing","offering","empty").oneOf()
    nondet blocks = Set(Set(), Set(("alice","carol")), Set(("carol","alice"))).oneOf()
    val people = {..._BEGIN, secondSide: {kind: "person", person: "bob"}, ready: SIDES}
    val g = if (beginning == "empty") _INITIAL
      else if (beginning == "people") people
      else if (beginning == "bots") {..._BEGIN, firstSide: _BOT, secondSide: _BOT}
      else if (beginning == "playing" or beginning == "offering") {...people, status: "active", starts: 1, drawOfferedBy: if(beginning == "offering") "alice" else ""}
      else _BEGIN
    all {
      _gameId' = if (g.status == "none") 0 else 1,
      _gameIdShown' = DEVICES.mapBy(p => if (p == "carol" or g.status == "none") 0 else 1),
      _status' = g.status,
    _creator' = g.creator,
    _firstSide' = g.firstSide,
    _secondSide' = g.secondSide,
    _ready' = g.ready,
    _minutes' = g.minutes,
    _increment' = g.increment,
    _starts' = g.starts,
    _result' = g.result,
    _drawOfferedBy' = g.drawOfferedBy,
      statusShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.status else g.status),
      creatorShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.creator else g.creator),
      firstSideShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.firstSide else g.firstSide),
      secondSideShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.secondSide else g.secondSide),
      readyShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.ready else g.ready),
      minutesShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.minutes else g.minutes),
      incrementShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.increment else g.increment),
      startsShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.starts else g.starts),
      resultShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.result else g.result),
      drawOfferedByShown' = DEVICES.mapBy(p => if (p == "carol") _INITIAL.drawOfferedBy else g.drawOfferedBy),
      refusal' = DEVICES.mapBy(_ => ""),
      _offline' = Set(), _members' = Set("alice","bob"), _spaceEnded' = false, _signedOut' = Set(),
      _moves' = 0, _declinedOffers' = Set(), _blocks' = blocks, _blockIgnored' = false,
      _frozen' = if (g.starts == 1) _config(g) else _config(_INITIAL), _sealed' = false,
      _cutOffStatus' = DEVICES.mapBy(_ => _INITIAL.status),
      _cutOffCreator' = DEVICES.mapBy(_ => _INITIAL.creator),
      _cutOffFirstSide' = DEVICES.mapBy(_ => _INITIAL.firstSide),
      _cutOffSecondSide' = DEVICES.mapBy(_ => _INITIAL.secondSide),
      _cutOffReady' = DEVICES.mapBy(_ => _INITIAL.ready),
      _cutOffMinutes' = DEVICES.mapBy(_ => _INITIAL.minutes),
      _cutOffIncrement' = DEVICES.mapBy(_ => _INITIAL.increment),
      _cutOffStarts' = DEVICES.mapBy(_ => _INITIAL.starts),
      _cutOffResult' = DEVICES.mapBy(_ => _INITIAL.result),
      _cutOffDrawofferedby' = DEVICES.mapBy(_ => _INITIAL.drawOfferedBy),
    }
  }

  /// A person creates a custom game, or hears why it is refused.
  action createGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"create") == "", _reason(customGame,actor,"create","first",actor,0,0) == "", _acceptChoice(actor,"create","first",actor,0,0) }

  /// A person creates a rematch in the custom game, or hears why it is refused.
  action rematch(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"rematch") == "", _reason(customGame,actor,"rematch","first",actor,0,0) == "", _acceptChoice(actor,"rematch","first",actor,0,0) }

  /// A person takes a side in the custom game, or hears why it is refused.
  action takeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"take") == "", _reason(customGame,actor,"take",side,actor,0,0) == "", _acceptChoice(actor,"take",side,actor,0,0) }

  /// A person assigns a bot in the custom game, or hears why it is refused.
  action assignBot(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"bot") == "", _reason(customGame,actor,"bot",side,actor,0,0) == "", _acceptChoice(actor,"bot",side,actor,0,0) }

  /// A person opens a side in the custom game, or hears why it is refused.
  action openSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"open") == "", _reason(customGame,actor,"open",side,actor,0,0) == "", _acceptChoice(actor,"open",side,actor,0,0) }

  /// A person closes a side in the custom game, or hears why it is refused.
  action closeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"close") == "", _reason(customGame,actor,"close",side,actor,0,0) == "", _acceptChoice(actor,"close",side,actor,0,0) }

  /// A person invites another person in the custom game, or hears why it is refused.
  action invite(actor: Person, side: Side, person: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"invite") == "", _reason(customGame,actor,"invite",side,person,0,0) == "", _acceptChoice(actor,"invite",side,person,0,0) }

  /// A person accepts an invitation in the custom game, or hears why it is refused.
  action acceptSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"accept") == "", _reason(customGame,actor,"accept",side,actor,0,0) == "", _acceptChoice(actor,"accept",side,actor,0,0) }

  /// A person declines an invitation in the custom game, or hears why it is refused.
  action declineSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"decline") == "", _reason(customGame,actor,"decline",side,actor,0,0) == "", _acceptChoice(actor,"decline",side,actor,0,0) }

  /// A person revokes an invitation in the custom game, or hears why it is refused.
  action revokeSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"revoke") == "", _reason(customGame,actor,"revoke",side,actor,0,0) == "", _acceptChoice(actor,"revoke",side,actor,0,0) }

  /// A person claims an open side in the custom game, or hears why it is refused.
  action claimSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"claim") == "", _reason(customGame,actor,"claim",side,actor,0,0) == "", _acceptChoice(actor,"claim",side,actor,0,0) }

  /// A person releases their side in the custom game, or hears why it is refused.
  action releaseSide(actor: Person, side: Side): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"release") == "", _reason(customGame,actor,"release",side,actor,0,0) == "", _acceptChoice(actor,"release",side,actor,0,0) }

  /// A person becomes ready in the custom game, or hears why it is refused.
  action becomeReady(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"ready") == "", _reason(customGame,actor,"ready","first",actor,0,0) == "", _acceptChoice(actor,"ready","first",actor,0,0) }

  /// A person withdraws readiness in the custom game, or hears why it is refused.
  action becomeUnready(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"unready") == "", _reason(customGame,actor,"unready","first",actor,0,0) == "", _acceptChoice(actor,"unready","first",actor,0,0) }

  /// A person swaps the sides in the custom game, or hears why it is refused.
  action swapSides(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"swap") == "", _reason(customGame,actor,"swap","first",actor,0,0) == "", _acceptChoice(actor,"swap","first",actor,0,0) }

  /// A person chooses the clock in the custom game, or hears why it is refused.
  action chooseClock(actor: Person, minutes: int, increment: int): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"clock") == "", _reason(customGame,actor,"clock","first",actor,minutes,increment) == "", _acceptChoice(actor,"clock","first",actor,minutes,increment) }

  /// A person starts the custom game, or hears why it is refused.
  action startGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"start") == "", _reason(customGame,actor,"start","first",actor,0,0) == "", _acceptChoice(actor,"start","first",actor,0,0) }

  /// A person cancels the custom game, or hears why it is refused.
  action cancelGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"cancel") == "", _reason(customGame,actor,"cancel","first",actor,0,0) == "", _acceptChoice(actor,"cancel","first",actor,0,0) }

  /// A person resigns the custom game, or hears why it is refused.
  action resignGame(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"resign") == "", _reason(customGame,actor,"resign","first",actor,0,0) == "", _acceptChoice(actor,"resign","first",actor,0,0) }

  /// A person offers a draw in the custom game, or hears why it is refused.
  action offerDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"offer") == "", _reason(customGame,actor,"offer","first",actor,0,0) == "", _acceptChoice(actor,"offer","first",actor,0,0) }

  /// A person accepts a draw in the custom game, or hears why it is refused.
  action acceptDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"agree") == "", _reason(customGame,actor,"agree","first",actor,0,0) == "", _acceptChoice(actor,"agree","first",actor,0,0) }

  /// A person declines a draw in the custom game, or hears why it is refused.
  action declineDraw(actor: Person): bool = all { not(_offline.contains(actor)), _connectionReason(customGame,actor,"reject") == "", _reason(customGame,actor,"reject","first",actor,0,0) == "", _acceptChoice(actor,"reject","first",actor,0,0) }

  def _connectedPerson(person: Person): bool = _members.contains(person) and DEVICES.exists(device =>
    _personOf(device) == person and not(_offline.contains(device)) and _visible(device,_members,_offline,_signedOut))
  /// The first side's winning move by the game's rules, or a clock running out,
  /// finishes a custom game under way without changing its choices. People
  /// making the winning move need a signed-in device with a connection. The first
  /// side must move before the second side's clock can run out from the starting
  /// position; a running clock never waits for either person to return.
  action _finishGame(result: str): bool = all {
    customGame.status == "active",
    customGame.firstSide.kind == "person", customGame.secondSide.kind == "person",
    customGame.minutes > 0 or Set("first side wins by the game's rules").contains(result),
    Set("first side wins by the game's rules").contains(result) implies SIDES.forall(side => _connectedPerson(_side(customGame,side).person)),
    result == "first side wins on time" implies _connectedPerson(customGame.firstSide.person),
    _update({...customGame, status: "completed", result: result, drawOfferedBy: ""}, _offline, _members,_signedOut, refusal, false),
  }
  /// A participant or bot makes a move the game allows for the side to move, the
  /// first side first and then in turn, in the custom game's first three moves;
  /// the game's rules decide which move. A move clears a waiting draw offer and
  /// lets the mover offer a draw again.
  action _sideMoves(side: Side): bool = {
    val mover = _side(customGame,side)
    all {
      customGame.status == "active", _moves < 3,
      side == (if (_moves % 2 == 0) "first" else "second"),
      mover.kind == "bot" or (mover.kind == "person" and _connectedPerson(mover.person)),
      _updateAll({...customGame, drawOfferedBy: ""},_offline,_members,_signedOut,refusal,false,
        _moves + 1,_declinedOffers.exclude(Set(mover.person)),_blocks,_blockIgnored),
    }
  }
  /// Someone blocks another person. A block changes no side and never ends a custom game under way.
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
  /// A person's own missing connection is named before any other reason.
  /// The creator's own authority is named even while the host is offline.
  /// Any other missing connection is named before the remaining reasons.
  def _refusal(creatorOnly: bool, connection: str, priority: str, earlier: bool, otherwise: str): str =
    if (connection == "connection needed") connection
    else if (creatorOnly) "only the creator"
    else if (connection != "") connection
    else if (priority != "") priority
    else if (earlier) "choices changed"
    else otherwise

  /// Earlier choices never replace the agreed game. A person first hears
  /// why they cannot make that choice, or otherwise that the choices changed.
  action _staleChoice(actor: Person, command: str): bool = {
    val picture = _choicePicture(actor)
    val priority = _priorityReason(picture,actor,command)
    val connection = _connectionReason(picture,actor,command)
    val reason = _refusal(priority == "only the creator", connection, priority, false, "choices changed")
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
    val firstSpecific = _reason(picture,actor,command,side,person,1,0)
    val firstReason = _refusal(firstPriority == "only the creator" or firstSpecific == "only the creator", connection, firstPriority, firstEarlier, firstSpecific)
    val first = if (firstReason != "") customGame else _next(customGame,actor,command,side,person,1,0)
    val firstFresh = first != customGame and Set("create","rematch").contains(command)
    val firstDeclined = if (firstReason != "") _declinedOffers else _declinedAfter(customGame,command,_declinedOffers)
    val otherPicture = if (_offline.contains(other)) gameShown.get(other) else first
    val otherPictureId = if (_offline.contains(other)) _gameIdShown.get(other) else _gameId + (if (firstFresh) 1 else 0)
    val priority = _priorityReason(otherPicture,other,otherCommand)
    val choicesChanged = otherPictureId != referenceId or
      ((_settingCommand(otherCommand) or Set("start","cancel").contains(otherCommand)) and _config(otherPicture) != _config(reference))
    val otherConnection = _connectionReason(otherPicture,other,otherCommand)
    val secondSpecific = _reasonWith(otherPicture,firstDeclined,other,otherCommand,otherSide,person,1,0)
    val secondReason = _refusal(priority == "only the creator" or secondSpecific == "only the creator", otherConnection, priority, choicesChanged, secondSpecific)
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
    val specific = _reason(picture,actor,command,side,person,1,0)
    val reason = _refusal(specific == "only the creator", connection, "", false, specific)
    all {
      reason != "",
      _update(customGame,_offline,_members,_signedOut,refusal.set(actor,reason),false),
    }
  }

  /// Leaving releases a waiting side; a participant of a custom game under way resigns.
  /// The creator leaving ends the space and cancels an unfinished custom game.
  action _personLeaves(actor: Person): bool = all {
    _members.contains(_personOf(actor)), not(_offline.contains(actor)),
    val waiting = SIDES.fold(customGame, (g,s) => if (_side(g,s).person == _personOf(actor)) _replace(g,s,_EMPTY) else g)
    val changed = if (_personOf(actor) == "alice" and customGame.status != "none" and not(_terminal(customGame)))
      {...customGame, status: "cancelled", result: "cancelled", ready: Set(), drawOfferedBy: "", firstSide: if (customGame.firstSide.kind == "invitation") _EMPTY else customGame.firstSide, secondSide: if (customGame.secondSide.kind == "invitation") _EMPTY else customGame.secondSide}
      else if (customGame.status == "configuring") waiting
      else if (customGame.status == "active" and _personSide(customGame,_personOf(actor)) != "") {...customGame,status:"completed",result:if(_personSide(customGame,_personOf(actor)) == "first") "second side wins by resignation" else "first side wins by resignation",drawOfferedBy:""}
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
    nondet result = Set("first side wins by the game's rules", "first side wins on time", "second side wins on time").oneOf()
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
  val invExclusivePeople = customGame.firstSide.person == "" or customGame.secondSide.person == "" or customGame.firstSide.person != customGame.secondSide.person
  /// Readiness belongs only to an accepted person in a custom game being set up or started.
  val invReadyPeople = customGame.ready.forall(s => SIDES.contains(s) and _side(customGame,s).kind == "person")
  /// A started custom game has exactly two participants, never an invitation or open side.
  val invCompleteAtStart = customGame.starts == 1 implies SIDES.forall(s => Set("person","bot").contains(_side(customGame,s).kind))
  /// People in a custom game under way have agreed to its starting choices.
  val invAgreedAtStart = customGame.status == "active" implies customGame.ready == SIDES.filter(s => _side(customGame,s).kind == "person")
  /// A custom game starts at most once and cannot be under way without starting.
  val invOneStart = Set(0,1).contains(customGame.starts) and (customGame.status == "active" implies customGame.starts == 1)
  /// Custom games being set up, and absent ones, have never started; finished ones have.
  val invStartStatus = (customGame.starts == 1 implies Set("active","completed","cancelled").contains(customGame.status)) and (customGame.status == "completed" implies customGame.starts == 1)
  /// Starting choices are immutable; cancelling only clears readiness.
  val invStartingChoicesFrozen = customGame.starts == 1 implies _config(customGame) == _frozen
  /// Finished and cancelled custom games stay that way until a separate one is created.
  val invTerminalStaysTerminal = _sealed implies _terminal(customGame)
  /// Only a finished or cancelled custom game has a result.
  val invOutcomeOnlyAtEnd = _terminal(customGame) == (customGame.result != "")
  /// The space host is the creator, whether participating or watching.
  val invCreatorAuthority = customGame.status == "none" or customGame.creator == "alice"
  /// Draw offers belong to a participating person in a custom game under way.
  val invDrawOffer = customGame.drawOfferedBy != "" implies customGame.status == "active" and _personSide(customGame,customGame.drawOfferedBy) != ""
  /// A signed-in member who has a connection sees the agreed game.
  /// An offline guest retains the picture they last knew.
  val invConnectedAgree = DEVICES.forall(p => _offline.contains(p) or gameShown.get(p) == (if (_visible(p,_members,_offline,_signedOut)) customGame else _INITIAL))
  /// Every refusal names one defined reason, including loss of connection.
  pure val _REASONS = Set("","not in the space","only the creator","no finished game","finish or cancel first","no custom game","finished","cancelled","already started","one side per person","person not in the space","not your invitation","no invitation","not an open place","not your side","not a participant","invalid clock choice","both sides need participants","every person must be ready","not started","not the other participant","draw agreement needs two people","connection needed","the host is offline","choices changed","resign instead","offer again after moving","cannot be invited","side not available")
  val invRefusalsDefined = refusal.keys() == DEVICES and DEVICES.forall(p => _REASONS.contains(refusal.get(p)))
  /// Choices stay in their admitted time and increment ranges.
  val invClockChoices = TIMES.contains(customGame.minutes) and INCREMENTS.contains(customGame.increment) and (customGame.minutes == 0 implies customGame.increment == 0)
  /// An offline person keeps their last picture during remote choices.
  val invOfflineKeepsPicture = DEVICES.forall(p => _offline.contains(p) implies statusShown.get(p) == _cutOffStatus.get(p) and creatorShown.get(p) == _cutOffCreator.get(p) and firstSideShown.get(p) == _cutOffFirstSide.get(p) and secondSideShown.get(p) == _cutOffSecondSide.get(p) and readyShown.get(p) == _cutOffReady.get(p) and minutesShown.get(p) == _cutOffMinutes.get(p) and incrementShown.get(p) == _cutOffIncrement.get(p) and startsShown.get(p) == _cutOffStarts.get(p) and resultShown.get(p) == _cutOffResult.get(p) and drawOfferedByShown.get(p) == _cutOffDrawofferedby.get(p))
  /// Moves and declined draw offers belong only to a custom game under way.
  val invMovesOnlyWhileActive = (_moves != 0 or _declinedOffers != Set()) implies customGame.status == "active"
  /// Someone whose draw offer was declined cannot offer again before moving.
  val invNoRepeatedOffer = customGame.drawOfferedBy == "" or not(_declinedOffers.contains(customGame.drawOfferedBy))
  /// No invitation or claim ever crosses a block with the creator.
  val invBlocksRespected = not(_blockIgnored)
  /// Each connected person sees their own accepted side nearest; everyone else sees the first side nearest.
  val invOwnSideNearest = DEVICES.forall(d =>
    (not(_offline.contains(d)) and _visible(d,_members,_offline,_signedOut)) implies
      nearestSide.get(d) == (if (_personSide(customGame,_personOf(d)) == "second") "second" else "first"))
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
    _firstSide.in(_PARTICIPANTS),
    firstSideShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffFirstSide.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _secondSide.in(_PARTICIPANTS),
    secondSideShown.in(DEVICES.setOfMaps(_PARTICIPANTS)),
    _cutOffSecondSide.in(DEVICES.setOfMaps(_PARTICIPANTS)),
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
    _result.in(Set("","cancelled","draw","first side wins by resignation","second side wins by resignation","first side wins by the game's rules","first side wins on time","second side wins on time")),
    resultShown.in(DEVICES.setOfMaps(Set("","cancelled","draw","first side wins by resignation","second side wins by resignation","first side wins by the game's rules","first side wins on time","second side wins on time"))),
    _cutOffResult.in(DEVICES.setOfMaps(Set("","cancelled","draw","first side wins by resignation","second side wins by resignation","first side wins by the game's rules","first side wins on time","second side wins on time"))),
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
    invMovesOnlyWhileActive, invNoRepeatedOffer, invBlocksRespected, invOwnSideNearest,
  }
}
