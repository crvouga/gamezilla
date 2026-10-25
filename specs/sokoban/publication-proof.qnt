// Alice prepares one Sokoban draft for publication. Its board is one of two
// boards with nothing to correct, or a board that still has something to
// correct; its details are its title, description and difficulty. A Sokoban
// puzzle is published only with proof: a completed playtest of exactly the
// board being published, under Sokoban's current rules. A playtest plays the
// board as it was when the playtest began. A board edit leaves the board
// without proof, even one that brings back an earlier board; changing only
// the details keeps the proof; a playtest under way or stopped before it was
// complete adds no proof and takes none away; and a rules change leaves no
// proof from a playtest completed before it. A board with something to
// correct cannot be playtested. Publishing a proven board again with nothing
// changed makes no new edition, and no edit changes an edition already
// published.
// Alice's phone starts connected. Without a connection she can still build,
// change the details and playtest. Choosing publication then waits for the
// connection: when it returns, the proven board she chose is published,
// unless Sokoban's rules changed meanwhile, which leaves it unpublished.
// The examples use three boards, two sets of details, one rules change and at
// most two editions; the product has no such limits.
module publication_proof {
  type Playtest = { board: int, rules: int, status: str }
  type Edition = { board: int, details: int, rules: int }

  pure val BOARDS = Set(0, 1, 2)
  pure val BOARD_TO_CORRECT = 2
  pure val DETAILS = Set(0, 1)
  pure val NO_PLAYTEST = { board: -1, rules: -1, status: "none" }
  pure val NO_EDITION = { board: -1, details: -1, rules: -1 }

  /// The draft's board: 0 and 1 have nothing to correct, 2 has something to correct.
  var board: int
  var details: int
  /// Sokoban's current rules: 0 before the rules change, 1 after it.
  var rules: int
  /// The latest playtest and the board it plays; its status is "none",
  /// "playing", "completed" or "stopped".
  var playtest: Playtest
  /// Whether the draft's board has proof.
  var proof: bool
  var editions: List[Edition]
  /// Whether a publication chosen without a connection waits for it.
  var waiting: bool
  var _chosen: Edition
  var _proven: Set[(int, int)]
  var _online: bool
  var _previousEditions: List[Edition]
  var _previousProof: bool
  var _previousBoard: int
  var _previousDetails: int
  var _previousRules: int

  action _keep(b: int, d: int, r: int, practice: Playtest, proven: bool,
    published: List[Edition], isWaiting: bool, chosen: Edition, online: bool): bool = all {
    board' = b, details' = d, rules' = r, playtest' = practice, proof' = proven,
    editions' = published, waiting' = isWaiting, _chosen' = chosen,
    _proven' = (if (practice.status == "completed")
      _proven.union(Set((practice.board, practice.rules))) else _proven),
    _online' = online, _previousEditions' = editions, _previousProof' = proof,
    _previousBoard' = board, _previousDetails' = details, _previousRules' = rules,
  }

  action _same: bool =
    _keep(board, details, rules, playtest, proof, editions, waiting, _chosen, _online)

  action init = all {
    board' = 0, details' = 0, rules' = 0, playtest' = NO_PLAYTEST, proof' = false,
    editions' = List(), waiting' = false, _chosen' = NO_EDITION, _proven' = Set(),
    _online' = true, _previousEditions' = List(), _previousProof' = false,
    _previousBoard' = 0, _previousDetails' = 0, _previousRules' = 0,
  }

  /// Any board edit gives the draft another board and leaves it without proof.
  /// A playtest under way keeps playing the board it began with.
  action editBoard(newBoard: int): bool = all {
    BOARDS.contains(newBoard), newBoard != board,
    _keep(newBoard, details, rules, playtest, false, editions, waiting, _chosen, _online),
  }

  /// Changing only the title, description or difficulty keeps the board and its proof.
  action editDetails(newDetails: int): bool = all {
    DETAILS.contains(newDetails), newDetails != details,
    _keep(board, newDetails, rules, playtest, proof, editions, waiting, _chosen, _online),
  }

  /// A playtest plays the draft's board as it is now, under the current rules,
  /// also offline. A board with something to correct is refused.
  action beginPlaytest: bool = all {
    playtest.status != "playing",
    if (board != BOARD_TO_CORRECT)
      _keep(board, details, rules, { board: board, rules: rules, status: "playing" }, proof,
        editions, waiting, _chosen, _online)
    else _same,
  }

  /// Completing a playtest proves the board only if it is still exactly the
  /// board played, under the same rules.
  action completePlaytest: bool = all {
    playtest.status == "playing",
    _keep(board, details, rules, { ...playtest, status: "completed" },
      proof or (playtest.board == board and playtest.rules == rules),
      editions, waiting, _chosen, _online),
  }

  /// Stopping a playtest before it is complete adds no proof and takes none away.
  action leavePlaytest: bool = all {
    playtest.status == "playing",
    _keep(board, details, rules, { ...playtest, status: "stopped" }, proof,
      editions, waiting, _chosen, _online),
  }

  /// Without proof publication is refused. With a connection a proven board
  /// becomes a new edition unless that exact edition is already the latest;
  /// without one the choice waits, and choosing again keeps it waiting.
  action publishPuzzle: bool = all {
    editions.length() < 2,
    val chosen = { board: board, details: details, rules: rules }
    val latest = editions.length() > 0 and editions[editions.length() - 1] == chosen
    if (not(proof) or waiting or latest) _same
    else if (_online)
      _keep(board, details, rules, playtest, proof, editions.append(chosen), false,
        NO_EDITION, _online)
    else _keep(board, details, rules, playtest, proof, editions, true, chosen, _online),
  }

  /// World event: Sokoban's rules change once. A playtest completed before it is no proof.
  action rulesChange: bool = all {
    rules == 0,
    _keep(board, details, 1, playtest, false, editions, waiting, _chosen, _online),
  }

  /// Model-only: the phone loses its connection; building and playtesting go on.
  action _loseConnection: bool = all {
    _online,
    _keep(board, details, rules, playtest, proof, editions, waiting, _chosen, false),
  }

  /// A waiting publication goes ahead only if its playtest is still proof
  /// under the current rules.
  action connectionReturns: bool = all {
    not(_online),
    if (waiting and _chosen.rules == rules)
      _keep(board, details, rules, playtest, proof, editions.append(_chosen), false,
        NO_EDITION, true)
    else _keep(board, details, rules, playtest, proof, editions, false, NO_EDITION, true),
  }

  action step = {
    nondet newBoard = BOARDS.oneOf()
    nondet newDetails = DETAILS.oneOf()
    any { editBoard(newBoard), editDetails(newDetails), beginPlaytest, completePlaytest,
      leavePlaytest, publishPuzzle, rulesChange, _loseConnection, connectionReturns }
  }

  /// Every published edition's board was completed in a playtest of exactly
  /// that board, under the rules it was published with.
  val invPublishedBoardsWereProven = editions.indices().forall(i =>
    _proven.contains((editions[i].board, editions[i].rules)))
  /// Proof comes only from a completed playtest of exactly the draft's board
  /// under the current rules; a playtest under way or stopped adds none.
  val invProofComesFromACompletedPlaytest = proof implies _proven.contains((board, rules))
  /// A board edit leaves the new board without proof.
  val invBoardEditLeavesNoProof = board != _previousBoard implies not(proof)
  /// Changing only the details keeps the proof the board had.
  val invDetailsEditKeepsProof = details != _previousDetails implies proof == _previousProof
  /// A rules change leaves no proof from a playtest completed before it.
  val invRulesChangeLeavesNoProof = rules != _previousRules implies not(proof)
  /// A board with something to correct is never playtested or proven.
  val invBoardToCorrectHasNoProof = board == BOARD_TO_CORRECT implies
    (not(proof) and playtest.board != BOARD_TO_CORRECT)
  /// Nothing is published while the phone has no connection.
  val invOfflinePublicationWaits = not(_online) implies editions == _previousEditions
  /// Only a proven board chosen without a connection waits.
  val invWaitingNeedsProofAndNoConnection = waiting implies
    (not(_online) and _proven.contains((_chosen.board, _chosen.rules)))
  /// No later edit, playtest or publication changes an earlier edition.
  val invEditionsNeverChange = _previousEditions.indices().forall(i =>
    editions.indices().contains(i) and editions[i] == _previousEditions[i])
}
