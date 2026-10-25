// Alice rides Comet. In a custom game Bob rides Ember, and in a Light Cycles
// Trio a bot rides Nova. In practice on Alice's own device, bots ride every
// rider but Comet. Carol watches, and Eve watches as a guest who is not
// signed in. Alice created the custom game: until she starts it she may
// choose its target score from 1 to 9, which is otherwise 3, and how well the
// bots ride. Light Cycles Quad adds Volt by the same rules.
//
// Comet starts at the top left heading right, Ember at the bottom right
// heading left and Nova at the top right heading down. Each new round every
// rider starts from the next rider's starting cell in seat order.
//
// Each round counts down, then every riding rider takes its steps at the
// same moment. A rider crashes when its step would take it outside the arena,
// onto any trail, onto the cell another rider also steps into, or past a
// rider coming head-on; every crash of a step is decided from where everyone
// was before it. A crashed rider stays where it was and keeps its trail until
// the round ends. When at most one rider is still riding, the round ends: the
// last rider riding scores one round win, or nobody scores for a drawn round.
// The first rider to reach the target score wins the game; after the last
// round the most round wins win, and equal leaders draw. A finished game
// never changes its score.
//
// Only a rider's own person steers it, from one device at a time, while its
// round counts down or rides. A turn straight back is ignored, two quick turns
// take effect one step after the other, and a turn never carries into another
// round. Bots steer by the same rules.
//
// In a game shared with other people, a person whose device has no connection
// is away: the arena keeps going for everyone else, the away person cannot
// steer, and their rider keeps going straight. After 3 seconds away their
// rider crashes for that round, and it sits out every round that begins while
// they are away. Coming back lets them ride again from the next round without
// bringing back a crashed rider or changing any trail or the score. When every
// person riding has been away for 30 seconds the game is called off and keeps
// its score. Carol's and Eve's connections change nothing for the riders.
// Practice needs no connection: Alice is never away in it.
module light_cycles_round {
  type Cell = (int, int)

  /// The arena is kept to 4 columns and 3 rows here, instead of 40 by 28, so every case can be checked.
  pure val COLUMNS = 4
  /// See COLUMNS.
  pure val ROWS = 3
  /// The last round is the 3rd here, instead of the 15th.
  pure val ROUND_LIMIT = 3
  pure val DEFAULT_TARGET = 3
  pure val PEOPLE = Set("alice", "bob", "carol", "eve")
  pure val ALL_RIDERS = Set("comet", "ember", "nova")
  pure val DIRECTIONS = Set("up", "down", "left", "right")
  pure val LEVELS = Set("easy", "medium", "hard")
  pure val DEVICES = Set("first", "other")
  pure val TARGET_CHOICES = Set(0, 1, 2, 9, 10)
  pure val START_CELLS = List((1, 1), (4, 3), (4, 1))
  pure val START_DIRECTIONS = List("right", "left", "down")

  /// "duel" for Light Cycles Duel, or "trio" for Light Cycles Trio.
  var mode: str
  /// Whether this is practice on Alice's own device against bots.
  var practice: bool
  /// How well the bots ride: "easy", "medium" or "hard".
  var botLevel: str
  /// The riders in this game.
  var riders: Set[str]
  /// The cell each rider is on.
  var riderCell: str -> Cell
  /// The direction each rider is heading.
  var heading: str -> str
  /// Each rider's trail in this round, its starting cell and its own cell included.
  var trail: str -> Set[Cell]
  /// The riders still riding in this round.
  var riding: Set[str]
  /// The riders that have crashed in this round.
  var crashed: Set[str]
  /// Each rider's quick turns still to take effect, the first one first.
  var waitingTurns: str -> List[str]
  /// The round being played, from 1; 0 before the game starts.
  var roundNumber: int
  /// The round is "counting down", "riding" or showing its "result".
  var roundStage: str
  /// The rider who won the round, "nobody" for a drawn round, or "" before the round ends.
  var roundWinner: str
  /// Each rider's round wins in this game.
  var roundWins: str -> int
  /// The round wins that win the game.
  var targetScore: int
  /// The game is "setting up", "under way", "finished" or "called off".
  var gameStage: str
  /// The rider who won the game, "draw" for a drawn game, or "" otherwise.
  var gameWinner: str
  /// The riders each person can steer now.
  var canSteer: str -> Set[str]
  /// The device each riding person steers from: "first" or "other".
  var steeringDevice: str -> str
  /// The people whose device has no connection.
  var offline: Set[str]

  var _refused: bool
  var _stepped: bool
  var _acceptedFrom: (str, str)
  var _beforeTurns: str -> List[str]
  var _beforeCell: str -> Cell
  var _beforeTrail: str -> Set[Cell]
  var _beforeRound: int
  var _beforeTarget: int
  var _beforeLevel: str
  var _beforeStage: str
  var _beforeDevices: str -> str
  var _wonRounds: int
  var _finalWins: str -> int
  var _outForAway: Set[str]

  pure def _ridersOf(m: str): Set[str] =
    if (m == "trio") ALL_RIDERS else Set("comet", "ember")
  pure def _seat(r: str): int = if (r == "comet") 0 else if (r == "ember") 1 else 2
  pure def _startIndex(r: str, rs: Set[str], round: int): int = (_seat(r) + round - 1) % rs.size()
  pure def _startCell(r: str, rs: Set[str], round: int): Cell = START_CELLS[_startIndex(r, rs, round)]
  pure def _startDirection(r: str, rs: Set[str], round: int): str = START_DIRECTIONS[_startIndex(r, rs, round)]
  pure def _personOf(r: str, inPractice: bool): str =
    if (r == "comet") "alice" else if (r == "ember" and not(inPractice)) "bob" else "bot"
  pure def _riderOf(p: str, inPractice: bool): Set[str] =
    if (p == "alice") Set("comet") else if (p == "bob" and not(inPractice)) Set("ember") else Set()
  pure def _ridingPeople(inPractice: bool): Set[str] = if (inPractice) Set("alice") else Set("alice", "bob")
  pure def _opposite(d: str): str =
    if (d == "up") "down" else if (d == "down") "up" else if (d == "left") "right" else "left"
  pure def _ahead(c: Cell, d: str): Cell =
    if (d == "up") (c._1, c._2 - 1)
    else if (d == "down") (c._1, c._2 + 1)
    else if (d == "left") (c._1 - 1, c._2)
    else (c._1 + 1, c._2)
  pure def _inArena(c: Cell): bool = c._1 >= 1 and c._1 <= COLUMNS and c._2 >= 1 and c._2 <= ROWS
  pure def _abs(n: int): int = if (n < 0) -n else n
  pure def _nextTo(a: Cell, b: Cell): bool = _abs(a._1 - b._1) + _abs(a._2 - b._2) == 1
  pure def _planned(d: str, turns: List[str]): str =
    if (turns.length() == 0) d else turns[turns.length() - 1]
  pure def _turnAllowed(d: str, turns: List[str], direction: str): bool =
    turns.length() < 2 and direction != _planned(d, turns) and direction != _opposite(_planned(d, turns))
  pure def _total(rs: Set[str], wins: str -> int): int = rs.fold(0, (sum, r) => sum + wins.get(r))
  pure def _most(rs: Set[str], wins: str -> int): int =
    rs.fold(0, (top, r) => if (wins.get(r) > top) wins.get(r) else top)
  pure def _leader(rs: Set[str], wins: str -> int): str = {
    val leaders = rs.filter(r => wins.get(r) == _most(rs, wins))
    if (leaders.size() == 1) leaders.fold("", (_, r) => r) else "draw"
  }
  pure def _away(p: str, inPractice: bool, offlineNow: Set[str]): bool =
    not(inPractice) and offlineNow.contains(p)
  pure def _steerable(p: str, inPractice: bool, stage: str, rStage: str, ridingNow: Set[str], offlineNow: Set[str]): Set[str] =
    if (stage == "under way" and rStage != "result" and not(_away(p, inPractice, offlineNow)))
      _riderOf(p, inPractice).intersect(ridingNow)
    else Set()
  pure def _validTurns(d: str, turns: List[str]): bool =
    turns.length() <= 2 and
    (turns.length() >= 1 implies (turns[0] != _opposite(d) and turns[0] != d)) and
    (turns.length() == 2 implies (turns[1] != _opposite(turns[0]) and turns[1] != turns[0]))

  action _set(
    level: str, cells: str -> Cell, heads: str -> str, trails: str -> Set[Cell],
    ridingNow: Set[str], turns: str -> List[str], round: int, rStage: str, rWinner: str,
    wins: str -> int, target: int, stage: str, gWinner: str, devices: str -> str,
    offlineNow: Set[str], refused: bool, stepped: bool, accepted: (str, str),
    wonRounds: int, outForAway: Set[str]
  ): bool = all {
    mode' = mode,
    practice' = practice,
    botLevel' = level,
    riders' = riders,
    riderCell' = cells,
    heading' = heads,
    trail' = trails,
    riding' = ridingNow,
    crashed' = if (stage == "setting up") Set() else riders.exclude(ridingNow),
    waitingTurns' = turns,
    roundNumber' = round,
    roundStage' = rStage,
    roundWinner' = rWinner,
    roundWins' = wins,
    targetScore' = target,
    gameStage' = stage,
    gameWinner' = gWinner,
    canSteer' = PEOPLE.mapBy(p => _steerable(p, practice, stage, rStage, ridingNow, offlineNow)),
    steeringDevice' = devices,
    offline' = offlineNow,
    _refused' = refused,
    _stepped' = stepped,
    _acceptedFrom' = accepted,
    _beforeTurns' = waitingTurns,
    _beforeCell' = riderCell,
    _beforeTrail' = trail,
    _beforeRound' = roundNumber,
    _beforeTarget' = targetScore,
    _beforeLevel' = botLevel,
    _beforeStage' = gameStage,
    _beforeDevices' = steeringDevice,
    _wonRounds' = wonRounds,
    _finalWins' = if (Set("finished", "called off").contains(gameStage)) _finalWins else wins,
    _outForAway' = outForAway,
  }

  /// Everything stays as it is, apart from who has a connection, which device steers and whether a choice was refused.
  action _keep(devices: str -> str, offlineNow: Set[str], refused: bool): bool =
    _set(botLevel, riderCell, heading, trail, riding, waitingTurns, roundNumber, roundStage,
      roundWinner, roundWins, targetScore, gameStage, gameWinner, devices, offlineNow, refused,
      false, ("", ""), _wonRounds, _outForAway)

  /// Sets every rider on its starting cell for a round's countdown; the rider of a person who is away sits it out.
  action _beginRound(round: int): bool = {
    val sittingOut = riders.filter(r => _away(_personOf(r, practice), practice, offline))
    _set(botLevel,
      ALL_RIDERS.mapBy(r => _startCell(r, riders, round)),
      ALL_RIDERS.mapBy(r => _startDirection(r, riders, round)),
      ALL_RIDERS.mapBy(r => if (riders.contains(r)) Set(_startCell(r, riders, round)) else Set()),
      riders.exclude(sittingOut), ALL_RIDERS.mapBy(_ => List()), round, "counting down", "",
      roundWins, targetScore, "under way", "", steeringDevice, offline, false, false, ("", ""),
      _wonRounds, sittingOut)
  }

  /// Ends the round when at most one rider is still riding, scoring it once, and finishes the game when it is won or the last round ends.
  action _afterMove(
    cells: str -> Cell, heads: str -> str, trails: str -> Set[Cell], ridingNow: Set[str],
    turns: str -> List[str], stepped: bool, outForAway: Set[str]
  ): bool = {
    val over = ridingNow.size() <= 1
    val winner = if (not(over)) "" else if (ridingNow.size() == 1) ridingNow.fold("", (_, r) => r) else "nobody"
    val scored = over and winner != "nobody"
    val wins = if (scored) roundWins.set(winner, roundWins.get(winner) + 1) else roundWins
    val reached = scored and wins.get(winner) >= targetScore
    val limit = over and roundNumber >= ROUND_LIMIT
    _set(botLevel, cells, heads, trails, ridingNow,
      if (over) ALL_RIDERS.mapBy(_ => List()) else turns,
      roundNumber, if (over) "result" else "riding", winner, wins, targetScore,
      if (reached or limit) "finished" else gameStage,
      if (reached) winner else if (limit) _leader(riders, wins) else "",
      steeringDevice, offline, false, stepped, ("", ""),
      if (scored) _wonRounds + 1 else _wonRounds, outForAway)
  }

  action init = {
    nondet m = Set("duel", "trio").oneOf()
    nondet inPractice = Set(false, true).oneOf()
    val rs = _ridersOf(m)
    all {
      mode' = m,
      practice' = inPractice,
      botLevel' = "medium",
      riders' = rs,
      riderCell' = ALL_RIDERS.mapBy(r => _startCell(r, rs, 1)),
      heading' = ALL_RIDERS.mapBy(r => _startDirection(r, rs, 1)),
      trail' = ALL_RIDERS.mapBy(_ => Set()),
      riding' = Set(),
      crashed' = Set(),
      waitingTurns' = ALL_RIDERS.mapBy(_ => List()),
      roundNumber' = 0,
      roundStage' = "counting down",
      roundWinner' = "",
      roundWins' = ALL_RIDERS.mapBy(_ => 0),
      targetScore' = DEFAULT_TARGET,
      gameStage' = "setting up",
      gameWinner' = "",
      canSteer' = PEOPLE.mapBy(_ => Set()),
      steeringDevice' = PEOPLE.mapBy(_ => "first"),
      offline' = Set(),
      _refused' = false,
      _stepped' = false,
      _acceptedFrom' = ("", ""),
      _beforeTurns' = ALL_RIDERS.mapBy(_ => List()),
      _beforeCell' = ALL_RIDERS.mapBy(r => _startCell(r, rs, 1)),
      _beforeTrail' = ALL_RIDERS.mapBy(_ => Set()),
      _beforeRound' = 0,
      _beforeTarget' = DEFAULT_TARGET,
      _beforeLevel' = "medium",
      _beforeStage' = "setting up",
      _beforeDevices' = PEOPLE.mapBy(_ => "first"),
      _wonRounds' = 0,
      _finalWins' = ALL_RIDERS.mapBy(_ => 0),
      _outForAway' = Set(),
    }
  }

  /// Alice, the creator, chooses the target score from 1 to 9 before the game starts; anyone else, any other number and a game that has started are refused.
  action chooseTargetScore(person: str, target: int): bool = {
    val allowed = person == "alice" and gameStage == "setting up" and target >= 1 and target <= 9
    _set(botLevel, riderCell, heading, trail, riding, waitingTurns, roundNumber, roundStage,
      roundWinner, roundWins, if (allowed) target else targetScore, gameStage, gameWinner,
      steeringDevice, offline, not(allowed), false, ("", ""), _wonRounds, _outForAway)
  }

  /// Alice, the creator, chooses how well the bots ride before the game starts; anyone else and a game that has started are refused.
  action chooseBotLevel(person: str, level: str): bool = {
    val allowed = person == "alice" and gameStage == "setting up"
    _set(if (allowed) level else botLevel, riderCell, heading, trail, riding, waitingTurns,
      roundNumber, roundStage, roundWinner, roundWins, targetScore, gameStage, gameWinner,
      steeringDevice, offline, not(allowed), false, ("", ""), _wonRounds, _outForAway)
  }

  /// Alice starts the custom game: the first round counts down with every rider on its starting cell. Starting it again changes nothing.
  action startGame = all {
    not(practice),
    if (gameStage == "setting up") _beginRound(1) else _keep(steeringDevice, offline, true),
  }

  /// Alice starts practice on her own device, with or without a connection. Starting it again changes nothing.
  action startPractice = all {
    practice,
    if (gameStage == "setting up") _beginRound(1) else _keep(steeringDevice, offline, true),
  }

  /// A person chooses a turn for a rider from one of their devices. Only the rider's own person may, from the device they ride from, while the round they chose it in counts down or rides; anything else, a third quick turn and a turn straight back are refused and change nothing.
  action steer(person: str, rider: str, direction: str, chosenIn: int, device: str): bool = {
    val turns = waitingTurns.get(rider)
    val allowed = canSteer.get(person).contains(rider) and chosenIn == roundNumber and
      device == steeringDevice.get(person) and _turnAllowed(heading.get(rider), turns, direction)
    _set(botLevel, riderCell, heading, trail, riding,
      if (allowed) waitingTurns.set(rider, turns.append(direction)) else waitingTurns,
      roundNumber, roundStage, roundWinner, roundWins, targetScore, gameStage, gameWinner,
      steeringDevice, offline, not(allowed), false, if (allowed) (person, device) else ("", ""),
      _wonRounds, _outForAway)
  }

  /// A bot steers its riding rider by the same rules as a person.
  action botSteers(rider: str, direction: str): bool = {
    val turns = waitingTurns.get(rider)
    val allowed = gameStage == "under way" and roundStage != "result" and riding.contains(rider) and
      _turnAllowed(heading.get(rider), turns, direction)
    all {
      riders.contains(rider),
      _personOf(rider, practice) == "bot",
      _set(botLevel, riderCell, heading, trail, riding,
        if (allowed) waitingTurns.set(rider, turns.append(direction)) else waitingTurns,
        roundNumber, roundStage, roundWinner, roundWins, targetScore, gameStage, gameWinner,
        steeringDevice, offline, not(allowed), false, ("", ""), _wonRounds, _outForAway),
    }
  }

  /// A riding person carries on from their other device: from then on only that device steers their rider. Practice stays on its own device.
  action switchDevices(person: str): bool = all {
    _riderOf(person, practice) != Set(),
    if (practice) _keep(steeringDevice, offline, true)
    else _keep(steeringDevice.set(person, if (steeringDevice.get(person) == "first") "other" else "first"), offline, false),
  }

  /// The countdown ends and riding begins; a round with at most one rider riding ends at once.
  action countdownEnds = all {
    gameStage == "under way",
    roundStage == "counting down",
    _afterMove(riderCell, heading, trail, riding, waitingTurns, false, _outForAway),
  }

  /// Every riding rider takes one step at the same moment, and every crash is decided from where everyone was before it.
  action ridersStep = {
    val turnNow = ALL_RIDERS.mapBy(r =>
      if (riding.contains(r) and waitingTurns.get(r).length() > 0) waitingTurns.get(r)[0] else heading.get(r))
    val target = ALL_RIDERS.mapBy(r => _ahead(riderCell.get(r), turnNow.get(r)))
    val taken = riders.fold(Set(), (cells, r) => cells.union(trail.get(r)))
    val crashing = riding.filter(r =>
      not(_inArena(target.get(r))) or taken.contains(target.get(r)) or
      riding.exists(s => s != r and target.get(s) == target.get(r)))
    val moving = riding.exclude(crashing)
    all {
      gameStage == "under way",
      roundStage == "riding",
      _afterMove(
        ALL_RIDERS.mapBy(r => if (moving.contains(r)) target.get(r) else riderCell.get(r)),
        ALL_RIDERS.mapBy(r => if (moving.contains(r)) turnNow.get(r) else heading.get(r)),
        ALL_RIDERS.mapBy(r => if (moving.contains(r)) trail.get(r).union(Set(target.get(r))) else trail.get(r)),
        moving,
        ALL_RIDERS.mapBy(r =>
          if (moving.contains(r) and waitingTurns.get(r).length() > 0) waitingTurns.get(r).slice(1, waitingTurns.get(r).length())
          else if (moving.contains(r)) waitingTurns.get(r)
          else List()),
        true, _outForAway),
    }
  }

  /// The round result has shown for 2 seconds: the arena is cleared and the next round counts down with the score kept.
  action resultEnds = all {
    gameStage == "under way",
    roundStage == "result",
    _beginRound(roundNumber + 1),
  }

  /// Time passing after the game is finished or called off changes nothing.
  action secondsPass = all {
    Set("finished", "called off").contains(gameStage),
    _keep(steeringDevice, offline, false),
  }

  /// A person's device loses its connection.
  action loseConnection(person: str): bool = all {
    not(offline.contains(person)),
    _keep(steeringDevice, offline.union(Set(person)), false),
  }

  /// A person's connection comes back; a rider that crashed stays crashed until the next round.
  action connectionReturns(person: str): bool = all {
    offline.contains(person),
    _keep(steeringDevice, offline.exclude(Set(person)), false),
  }

  /// A riding person has been away for 3 seconds: their rider crashes for this round.
  action awayTooLong(person: str): bool = {
    val out = _riderOf(person, practice).intersect(riding)
    all {
      _away(person, practice, offline),
      gameStage == "under way",
      roundStage == "riding",
      out.size() == 1,
      _afterMove(riderCell, heading, trail, riding.exclude(out),
        ALL_RIDERS.mapBy(r => if (out.contains(r)) List() else waitingTurns.get(r)),
        false, _outForAway.union(out)),
    }
  }

  /// Every person riding has been away for 30 seconds: the game is called off with no winner and keeps its score.
  action everyoneAwayTooLong = all {
    not(practice),
    _ridingPeople(practice).subseteq(offline),
    gameStage == "under way",
    _set(botLevel, riderCell, heading, trail, riding, ALL_RIDERS.mapBy(_ => List()),
      roundNumber, roundStage, roundWinner, roundWins, targetScore, "called off", "",
      steeringDevice, offline, false, false, ("", ""), _wonRounds, _outForAway),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet rider = ALL_RIDERS.oneOf()
    nondet direction = DIRECTIONS.oneOf()
    nondet chosenIn = Set(roundNumber - 1, roundNumber).oneOf()
    nondet device = DEVICES.oneOf()
    nondet target = TARGET_CHOICES.oneOf()
    nondet level = LEVELS.oneOf()
    any {
      chooseTargetScore(person, target),
      chooseBotLevel(person, level),
      startGame,
      startPractice,
      steer(person, rider, direction, chosenIn, device),
      botSteers(rider, direction),
      switchDevices(person),
      countdownEnds,
      ridersStep,
      resultEnds,
      secondsPass,
      loseConnection(person),
      connectionReturns(person),
      awayTooLong(person),
      everyoneAwayTooLong,
    }
  }

  /// Duel has Comet and Ember; Trio adds Nova.
  val invMode = riders == _ridersOf(mode)
  /// Every rider and every trail stays inside the arena.
  val invInsideArena = riders.forall(r => _inArena(riderCell.get(r)) and trail.get(r).forall(c => _inArena(c)))
  /// Once the game has started, every rider is on its own trail and no two trails share a cell.
  val invTrailsApart = gameStage != "setting up" implies riders.forall(r =>
    trail.get(r).contains(riderCell.get(r)) and
    riders.forall(s => r == s or trail.get(r).intersect(trail.get(s)).size() == 0))
  /// A step moves every riding rider exactly one cell up, down, left or right, and a crashed rider stays where it was.
  val invOneCellAStep = _stepped implies riders.forall(r =>
    if (riding.contains(r)) _nextTo(_beforeCell.get(r), riderCell.get(r))
    else riderCell.get(r) == _beforeCell.get(r))
  /// A trail stays on the arena for the rest of its round.
  val invTrailsKept = roundNumber == _beforeRound implies riders.forall(r => _beforeTrail.get(r).subseteq(trail.get(r)))
  /// Every rider is either riding or crashed once the game has started.
  val invRidingOrCrashed = gameStage != "setting up" implies
    (riding.union(crashed) == riders and riding.intersect(crashed) == Set())
  /// Riding goes on only while at least two riders are riding.
  val invRoundEnds = (gameStage == "under way" and roundStage == "riding") implies riding.size() >= 2
  /// A round result names the last rider riding, or nobody for a drawn round.
  val invRoundWinner = if (roundStage == "result")
      (roundWinner == "nobody" and riding == Set()) or (riding == Set(roundWinner))
    else roundWinner == ""
  /// During a countdown every rider waits on its starting cell, which passes to the next rider each round.
  val invStartingCells = (gameStage == "under way" and roundStage == "counting down") implies riders.forall(r =>
    riderCell.get(r) == _startCell(r, riders, roundNumber) and
    heading.get(r) == _startDirection(r, riders, roundNumber) and
    trail.get(r) == Set(_startCell(r, riders, roundNumber)))
  /// Every round win comes from exactly one finished round.
  val invScoredOnce = _total(riders, roundWins) == _wonRounds and _wonRounds <= roundNumber
  /// The target score is from 1 to 9 and nobody passes it.
  val invTargetScore = targetScore >= 1 and targetScore <= 9 and riders.forall(r => roundWins.get(r) <= targetScore)
  /// A game is won by reaching the target score or by leading after the last round, and drawn only by equal leaders after the last round.
  val invVictory =
    if (gameWinner == "") gameStage != "finished"
    else gameStage == "finished" and (
      if (gameWinner == "draw") roundNumber == ROUND_LIMIT and _leader(riders, roundWins) == "draw"
      else riders.contains(gameWinner) and (
        roundWins.get(gameWinner) == targetScore or
        (roundNumber == ROUND_LIMIT and _leader(riders, roundWins) == gameWinner)))
  /// A finished or called-off game never changes its score.
  val invFinishedScore = Set("finished", "called off").contains(gameStage) implies roundWins == _finalWins
  /// A called-off game has no winner, and only a game shared with other people is called off.
  val invCalledOff = gameStage == "called off" implies (gameWinner == "" and not(practice))
  /// Each person steers only their own riding rider, and nobody steers while away, before the game, between rounds or after it.
  val invOwnSteering = PEOPLE.forall(p =>
    canSteer.get(p) == _steerable(p, practice, gameStage, roundStage, riding, offline) and
    canSteer.get(p).subseteq(_riderOf(p, practice)) and
    (_away(p, practice, offline) implies canSteer.get(p) == Set()))
  /// A turn is accepted only from the device its person rides from.
  val invOneDevice = _acceptedFrom._1 != "" implies _acceptedFrom._2 == steeringDevice.get(_acceptedFrom._1)
  /// A refused choice changes no turn, target score, bot level, game or steering device.
  val invRefusedChangesNothing = _refused implies (waitingTurns == _beforeTurns and targetScore == _beforeTarget and
    botLevel == _beforeLevel and gameStage == _beforeStage and steeringDevice == _beforeDevices)
  /// Practice is steered from Alice's first device only.
  val invPracticeOneDevice = practice implies steeringDevice.get("alice") == "first"
  /// The bots ride at one of the three levels.
  val invBotLevel = LEVELS.contains(botLevel)
  /// Only a riding rider has quick turns waiting: at most two, never straight back, and none carried into another round.
  val invWaitingTurns = ALL_RIDERS.forall(r =>
    ((not(riding.contains(r)) or roundStage == "result") implies waitingTurns.get(r) == List()) and
    _validTurns(heading.get(r), waitingTurns.get(r)))
  /// A rider that crashed or sat out because its person was away stays out of the round, even after its person comes back.
  val invAwayRiderOut = _outForAway.forall(r => not(riding.contains(r)))
  /// Practice needs no connection: Alice can steer Comet whenever it rides, and practice is never called off.
  val invPracticeNeedsNoConnection = practice implies (
    _outForAway == Set() and
    canSteer.get("alice") == (if (gameStage == "under way" and roundStage != "result") Set("comet").intersect(riding) else Set()))
}
