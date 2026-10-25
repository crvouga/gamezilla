// @model-profile: local
// Alice rides Comet and Bob rides Ember in a Light Cycles Duel; in a Light
// Cycles Trio, Carol rides Nova as well. Dave watches. Every rider is ridden
// by a person. The game is under way from its first countdown, played to a
// target score of 1 or 3 round wins.
//
// The arena here is 4 columns by 3 rows, and the 3rd round is the last, so
// every case can be checked; the product plays the same rules on 40 by 28
// with 15 rounds. Comet starts at column 1, row 1 heading right; Ember at
// column 4, row 3 heading left; Nova at column 4, row 1 heading down. In
// each new round every rider sets off from the next rider's starting cell
// in seat order.
//
// Time is the game's own: a countdown ends, the riders take a step, a round
// result ends. At each step every riding rider moves one cell at the same
// moment, and a rider crashes when that step would take it outside the
// arena, onto any trail, onto the cell another rider also steps into, or
// past a rider coming head-on; every crash is decided from where everyone
// was before the step. A crashed rider stays where it was and keeps its
// trail until the round ends. When at most one rider is still riding after
// a step, the round ends: the last rider riding scores one round win, or
// nobody scores for a drawn round. The first rider to reach the target score
// wins the game; after the last round the most round wins win, and equal
// leaders draw. A finished game never changes.
//
// Only a rider's own person steers it, while its round counts down or rides.
// A turn straight back is ignored, at most two quick turns wait and one takes
// effect each step, and a turn chosen in an earlier round never takes effect
// in a later one.
//
// The rules here have no connection dependency: they decide the one arena
// everyone sees. What a person sees without a connection, riders whose
// person is away or sitting out, bots, practice and steering from another
// device are in the Light Cycles features. Because every rider here has a
// person who rides, a countdown always ends with at least two riders riding.
module light_cycles_round {
  type Cell = (int, int)

  /// The arena is 4 columns by 3 rows here, instead of 40 by 28.
  pure val COLUMNS = 4
  /// See COLUMNS.
  pure val ROWS = 3
  /// The last round is the 3rd here, instead of the 15th.
  pure val ROUND_LIMIT = 3
  pure val PEOPLE = Set("alice", "bob", "carol", "dave")
  pure val ALL_RIDERS = Set("comet", "ember", "nova")
  pure val DIRECTIONS = Set("up", "down", "left", "right")
  pure val SEAT = Map("comet" -> "alice", "ember" -> "bob", "nova" -> "carol")
  pure val START_CELLS = List((1, 1), (4, 3), (4, 1))
  pure val START_DIRECTIONS = List("right", "left", "down")

  /// "duel" for Light Cycles Duel, or "trio" for Light Cycles Trio.
  var mode: str
  /// The riders in this game.
  var riders: Set[str]
  /// The cell each rider is on.
  var riderCell: str -> Cell
  /// The direction each rider is heading.
  var heading: str -> str
  /// The direction of each riding rider's next step; "" for a rider that has crashed.
  var nextStep: str -> str
  /// Each rider's trail in this round, its starting cell and its own cell included.
  var trail: str -> Set[Cell]
  /// The riders still riding in this round.
  var riding: Set[str]
  /// The riders that have crashed in this round.
  var crashed: Set[str]
  /// The round being played, from 1.
  var roundNumber: int
  /// The round is "counting down", "riding" or showing its "result".
  var roundStage: str
  /// The rider who won the round, "nobody" for a drawn round, or "" before the round ends.
  var roundWinner: str
  /// Each rider's round wins in this game.
  var roundWins: str -> int
  /// The round wins that win the game.
  var targetScore: int
  /// The game is "under way" or "finished".
  var gameStage: str
  /// The rider who won the game, "draw" for a drawn game, or "" before it finishes.
  var gameWinner: str

  var _turns: str -> List[str]
  var _refused: bool
  var _late: bool
  var _stepped: bool
  var _acceptedFrom: (str, str)
  var _beforeTurns: str -> List[str]
  var _beforeCell: str -> Cell
  var _beforeTrail: str -> Set[Cell]
  var _beforeRound: int
  var _beforeGame: (str -> Cell, str -> Set[Cell], int, str, str -> int, str)
  var _wonRounds: int

  pure def _ridersOf(m: str): Set[str] = if (m == "trio") ALL_RIDERS else Set("comet", "ember")
  pure def _seat(r: str): int = if (r == "comet") 0 else if (r == "ember") 1 else 2
  pure def _startIndex(r: str, rs: Set[str], round: int): int = (_seat(r) + round - 1) % rs.size()
  pure def _startCell(r: str, rs: Set[str], round: int): Cell = START_CELLS[_startIndex(r, rs, round)]
  pure def _startDirection(r: str, rs: Set[str], round: int): str = START_DIRECTIONS[_startIndex(r, rs, round)]
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
  pure def _planned(d: str, turns: List[str]): str = if (turns.length() == 0) d else turns[turns.length() - 1]
  pure def _turnAllowed(d: str, turns: List[str], direction: str): bool =
    turns.length() < 2 and direction != _planned(d, turns) and direction != _opposite(_planned(d, turns))
  pure def _next(r: str, ridingNow: Set[str], heads: str -> str, turns: str -> List[str]): str =
    if (not(ridingNow.contains(r))) "" else if (turns.get(r).length() > 0) turns.get(r)[0] else heads.get(r)
  pure def _total(rs: Set[str], wins: str -> int): int = rs.fold(0, (sum, r) => sum + wins.get(r))
  pure def _most(rs: Set[str], wins: str -> int): int =
    rs.fold(0, (top, r) => if (wins.get(r) > top) wins.get(r) else top)
  pure def _leader(rs: Set[str], wins: str -> int): str = {
    val leaders = rs.filter(r => wins.get(r) == _most(rs, wins))
    if (leaders.size() == 1) leaders.fold("", (_, r) => r) else "draw"
  }
  pure def _validTurns(d: str, turns: List[str]): bool =
    turns.length() <= 2 and
    (turns.length() >= 1 implies (turns[0] != _opposite(d) and turns[0] != d)) and
    (turns.length() == 2 implies (turns[1] != _opposite(turns[0]) and turns[1] != turns[0]))

  action _set(
    cells: str -> Cell, heads: str -> str, trails: str -> Set[Cell], ridingNow: Set[str],
    turns: str -> List[str], round: int, rStage: str, rWinner: str, wins: str -> int,
    stage: str, gWinner: str, refused: bool, late: bool, stepped: bool,
    accepted: (str, str), wonRounds: int
  ): bool = all {
    mode' = mode,
    riders' = riders,
    riderCell' = cells,
    heading' = heads,
    nextStep' = ALL_RIDERS.mapBy(r => _next(r, ridingNow, heads, turns)),
    trail' = trails,
    riding' = ridingNow,
    crashed' = riders.exclude(ridingNow),
    roundNumber' = round,
    roundStage' = rStage,
    roundWinner' = rWinner,
    roundWins' = wins,
    targetScore' = targetScore,
    gameStage' = stage,
    gameWinner' = gWinner,
    _turns' = turns,
    _refused' = refused,
    _late' = late,
    _stepped' = stepped,
    _acceptedFrom' = accepted,
    _beforeTurns' = _turns,
    _beforeCell' = riderCell,
    _beforeTrail' = trail,
    _beforeRound' = roundNumber,
    _beforeGame' = (riderCell, trail, roundNumber, roundStage, roundWins, gameWinner),
    _wonRounds' = wonRounds,
  }

  /// Nothing on the arena changes; a refused choice is marked as refused.
  action _unchanged(refused: bool, late: bool): bool =
    _set(riderCell, heading, trail, riding, _turns, roundNumber, roundStage, roundWinner,
      roundWins, gameStage, gameWinner, refused, late, false, ("", ""), _wonRounds)

  action init = {
    nondet m = Set("duel", "trio").oneOf()
    nondet target = Set(1, 3).oneOf()
    val rs = _ridersOf(m)
    val heads = ALL_RIDERS.mapBy(r => _startDirection(r, rs, 1))
    val noTurns = ALL_RIDERS.mapBy(_ => List())
    all {
      mode' = m,
      riders' = rs,
      riderCell' = ALL_RIDERS.mapBy(r => _startCell(r, rs, 1)),
      heading' = heads,
      nextStep' = ALL_RIDERS.mapBy(r => _next(r, rs, heads, noTurns)),
      trail' = ALL_RIDERS.mapBy(r => if (rs.contains(r)) Set(_startCell(r, rs, 1)) else Set()),
      riding' = rs,
      crashed' = Set(),
      roundNumber' = 1,
      roundStage' = "counting down",
      roundWinner' = "",
      roundWins' = ALL_RIDERS.mapBy(_ => 0),
      targetScore' = target,
      gameStage' = "under way",
      gameWinner' = "",
      _turns' = noTurns,
      _refused' = false,
      _late' = false,
      _stepped' = false,
      _acceptedFrom' = ("", ""),
      _beforeTurns' = noTurns,
      _beforeCell' = ALL_RIDERS.mapBy(r => _startCell(r, rs, 1)),
      _beforeTrail' = ALL_RIDERS.mapBy(r => if (rs.contains(r)) Set(_startCell(r, rs, 1)) else Set()),
      _beforeRound' = 1,
      _beforeGame' = (ALL_RIDERS.mapBy(r => _startCell(r, rs, 1)),
        ALL_RIDERS.mapBy(r => if (rs.contains(r)) Set(_startCell(r, rs, 1)) else Set()),
        1, "counting down", ALL_RIDERS.mapBy(_ => 0), ""),
      _wonRounds' = 0,
    }
  }

  /// A person chooses a turn for a rider. Only the rider's own person may, while its round counts down or rides and the rider is riding; a third quick turn and a turn straight back are ignored. Anything refused changes nothing.
  action steer(person: str, rider: str, direction: str): bool = {
    val turns = _turns.get(rider)
    val allowed = riders.contains(rider) and SEAT.get(rider) == person and gameStage == "under way" and
      roundStage != "result" and riding.contains(rider) and _turnAllowed(heading.get(rider), turns, direction)
    _set(riderCell, heading, trail, riding,
      if (allowed) _turns.set(rider, turns.append(direction)) else _turns,
      roundNumber, roundStage, roundWinner, roundWins, gameStage, gameWinner,
      not(allowed), false, false, if (allowed) (person, rider) else ("", ""), _wonRounds)
  }

  /// A turn a person chose in an earlier round arrives in a later one, or after the game: it is refused and changes nothing.
  action lateTurn(person: str, rider: str, direction: str): bool = all {
    roundNumber >= 2 or gameStage == "finished",
    riders.contains(rider),
    SEAT.get(rider) == person,
    DIRECTIONS.contains(direction),
    _unchanged(true, true),
  }

  /// Ends the round when at most one rider is still riding, scoring it once, and finishes the game when it is won or the last round ends.
  action _afterMove(cells: str -> Cell, heads: str -> str, trails: str -> Set[Cell], ridingNow: Set[str], turns: str -> List[str], stepped: bool): bool = {
    val over = ridingNow.size() <= 1
    val winner = if (not(over)) "" else if (ridingNow.size() == 1) ridingNow.fold("", (_, r) => r) else "nobody"
    val scored = over and winner != "nobody"
    val wins = if (scored) roundWins.set(winner, roundWins.get(winner) + 1) else roundWins
    val reached = scored and wins.get(winner) >= targetScore
    val limit = over and roundNumber >= ROUND_LIMIT
    _set(cells, heads, trails, ridingNow,
      if (over) ALL_RIDERS.mapBy(_ => List()) else turns,
      roundNumber, if (over) "result" else "riding", winner, wins,
      if (reached or limit) "finished" else gameStage,
      if (reached) winner else if (limit) _leader(riders, wins) else "",
      false, false, stepped, ("", ""), if (scored) _wonRounds + 1 else _wonRounds)
  }

  /// The 3-second countdown ends and the riders begin riding.
  action countdownEnds = all {
    gameStage == "under way",
    roundStage == "counting down",
    _afterMove(riderCell, heading, trail, riding, _turns, false),
  }

  /// Every riding rider takes one step at the same moment, and every crash is decided from where everyone was before it.
  action ridersStep = {
    val turnNow = ALL_RIDERS.mapBy(r => _next(r, riding, heading, _turns))
    val target = ALL_RIDERS.mapBy(r => if (riding.contains(r)) _ahead(riderCell.get(r), turnNow.get(r)) else riderCell.get(r))
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
          if (moving.contains(r) and _turns.get(r).length() > 0) _turns.get(r).slice(1, _turns.get(r).length())
          else if (moving.contains(r)) _turns.get(r)
          else List()),
        true),
    }
  }

  /// The round result has shown for 2 seconds: the arena is cleared and the next round counts down, every rider on the next rider's starting cell, with the score kept.
  action resultEnds = {
    val round = roundNumber + 1
    all {
      gameStage == "under way",
      roundStage == "result",
      _set(
        ALL_RIDERS.mapBy(r => _startCell(r, riders, round)),
        ALL_RIDERS.mapBy(r => _startDirection(r, riders, round)),
        ALL_RIDERS.mapBy(r => if (riders.contains(r)) Set(_startCell(r, riders, round)) else Set()),
        riders, ALL_RIDERS.mapBy(_ => List()), round, "counting down", "", roundWins,
        gameStage, "", false, false, false, ("", ""), _wonRounds),
    }
  }

  /// Time passing after the game is finished changes nothing.
  action secondsPass = all {
    gameStage == "finished",
    _unchanged(false, false),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet rider = ALL_RIDERS.oneOf()
    nondet direction = DIRECTIONS.oneOf()
    any {
      steer(person, rider, direction),
      lateTurn(person, rider, direction),
      countdownEnds,
      ridersStep,
      resultEnds,
      secondsPass,
    }
  }

  /// Duel has Comet and Ember; Trio adds Nova.
  val invMode = riders == _ridersOf(mode)
  /// Every rider and every trail stays inside the arena.
  val invInsideArena = riders.forall(r => _inArena(riderCell.get(r)) and trail.get(r).forall(c => _inArena(c)))
  /// Every rider is on its own trail, and no two trails share a cell.
  val invTrailsApart = riders.forall(r =>
    trail.get(r).contains(riderCell.get(r)) and
    riders.forall(s => r == s or trail.get(r).intersect(trail.get(s)).size() == 0))
  /// A step moves every riding rider exactly one cell up, down, left or right, and a crashed rider stays where it was.
  val invOneCellAStep = _stepped implies riders.forall(r =>
    if (riding.contains(r)) _nextTo(_beforeCell.get(r), riderCell.get(r))
    else riderCell.get(r) == _beforeCell.get(r))
  /// A trail stays on the arena for the rest of its round.
  val invTrailsKept = roundNumber == _beforeRound implies riders.forall(r => _beforeTrail.get(r).subseteq(trail.get(r)))
  /// Every rider is either riding or crashed.
  val invRidingOrCrashed = riding.union(crashed) == riders and riding.intersect(crashed) == Set()
  /// Riding goes on only while at least two riders are riding, and every countdown has them all.
  val invRoundEnds = gameStage == "under way" implies (
    (roundStage == "riding" implies riding.size() >= 2) and
    (roundStage == "counting down" implies riding == riders))
  /// A round result names the last rider riding, or nobody for a drawn round.
  val invRoundWinner = if (roundStage == "result")
      (roundWinner == "nobody" and riding == Set()) or (riding == Set(roundWinner))
    else roundWinner == ""
  /// During a countdown every rider waits on its starting cell, which passes to the next rider each round.
  val invStartingCells = roundStage == "counting down" implies riders.forall(r =>
    riderCell.get(r) == _startCell(r, riders, roundNumber) and
    heading.get(r) == _startDirection(r, riders, roundNumber) and
    trail.get(r) == Set(_startCell(r, riders, roundNumber)))
  /// Each riding rider's next step is its first waiting turn or straight ahead, never straight back; a crashed rider has none.
  val invNextStep = ALL_RIDERS.forall(r =>
    nextStep.get(r) == _next(r, riding, heading, _turns) and
    (riding.contains(r) implies nextStep.get(r) != _opposite(heading.get(r))))
  /// At most two quick turns wait, never straight back, only for a riding rider, and none carry into another round.
  val invWaitingTurns = ALL_RIDERS.forall(r =>
    ((not(riding.contains(r)) or roundStage == "result") implies _turns.get(r) == List()) and
    _validTurns(heading.get(r), _turns.get(r)))
  /// A turn is accepted only from the rider's own person.
  val invOwnSteering = _acceptedFrom._1 != "" implies SEAT.get(_acceptedFrom._2) == _acceptedFrom._1
  /// A refused or late turn changes nothing on the arena.
  val invRefusedChangesNothing = _refused implies (_turns == _beforeTurns and riderCell == _beforeCell and trail == _beforeTrail)
  /// A turn chosen in an earlier round is always refused.
  val invLateTurnRefused = _late implies _refused
  /// Every round win comes from exactly one ended round.
  val invScoredOnce = _total(riders, roundWins) == _wonRounds and _wonRounds <= roundNumber
  /// Nobody passes the target score.
  val invTargetScore = riders.forall(r => roundWins.get(r) <= targetScore)
  /// A game is won by reaching the target score or by leading after the last round, and drawn only by equal leaders after the last round.
  val invVictory =
    if (gameWinner == "") gameStage == "under way"
    else gameStage == "finished" and (
      if (gameWinner == "draw") roundNumber == ROUND_LIMIT and _leader(riders, roundWins) == "draw"
      else riders.contains(gameWinner) and (
        roundWins.get(gameWinner) == targetScore or
        (roundNumber == ROUND_LIMIT and _leader(riders, roundWins) == gameWinner)))
  /// A finished game never changes: its arena, round, score and winner stay as they were.
  val invFinishedGame = (gameStage == "finished" and _beforeGame._6 != "") implies
    _beforeGame == (riderCell, trail, roundNumber, roundStage, roundWins, gameWinner)
}
