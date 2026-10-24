// Alice's valid pack contains River and Valley. Her phone starts connected.
// She may choose publication offline; Bob discovers it only once it can be
// published. Her connected tablet can withdraw or republish River meanwhile.
// If River is withdrawn before the phone returns, publication is refused and
// the private draft stays kept. Making River available again never publishes
// a refused choice on its own: Alice chooses publication again. Reopening
// keeps the draft, including without a connection. A pack already published
// keeps its chosen editions when River is later withdrawn.
module publication_recovery {
  /// The complete private pack draft remains available to Alice.
  var draftKept: bool
  /// Whether River is available, as Alice's connected tablet sees it.
  var puzzleAvailable: bool
  /// Whether Alice's phone knows River is available.
  var availableOnPhone: bool
  /// The latest publication choice: "draft", "waiting", "published" or "refused".
  var publication: str
  /// Whether Bob can discover this pack.
  var discoverable: bool
  var _online: bool
  var _previousPublication: str
  var _publicationChosen: bool

  action _keep(available: bool, choice: str, online: bool, chosen: bool): bool = all {
    draftKept' = draftKept, puzzleAvailable' = available,
    availableOnPhone' = (if (online) available else availableOnPhone),
    publication' = choice, discoverable' = (choice == "published"),
    _online' = online, _previousPublication' = publication,
    _publicationChosen' = chosen,
  }

  action init = all {
    draftKept' = true, puzzleAvailable' = true, availableOnPhone' = true,
    publication' = "draft", discoverable' = false, _online' = true,
    _previousPublication' = "draft", _publicationChosen' = false,
  }

  /// A known withdrawal refuses at once. Otherwise an offline choice waits.
  /// Repeating an already published choice retains its stable pack edition.
  action publishPack: bool = {
    val choice = if (publication == "published") "published"
      else if (not(availableOnPhone)) "refused"
      else if (_online) "published" else "waiting"
    _keep(puzzleAvailable, choice, _online, true)
  }

  /// Alice's tablet withdraws River. Earlier published packs retain that edition.
  action withdrawChosenPuzzle: bool = _keep(false, publication, _online, false)

  /// Alice's tablet publishes River again; a refused pack choice still waits for her.
  action republishChosenPuzzle: bool = _keep(true, publication, _online, false)

  /// Reopening keeps the whole private draft and the latest publication choice.
  action reopenApp: bool = _keep(puzzleAvailable, publication, _online, false)

  /// Model-only: the phone loses its connection while the tablet stays connected.
  action _loseConnection: bool = all {
    _online, _keep(puzzleAvailable, publication, false, false),
  }

  /// A waiting publication goes ahead only if its chosen puzzle is still available.
  action connectionReturns: bool = all {
    not(_online),
    val choice = if (publication == "waiting")
      (if (puzzleAvailable) "published" else "refused") else publication
    _keep(puzzleAvailable, choice, true, false),
  }

  action step = any { publishPack, withdrawChosenPuzzle, republishChosenPuzzle,
    reopenApp, _loseConnection, connectionReturns }

  /// The private pack remains available whether publication succeeds or is refused.
  val invPublicationKeepsDraft = draftKept
  /// Only an actual publication makes the pack discoverable.
  val invDiscoveryRequiresPublication = discoverable == (publication == "published")
  /// Refusal never exposes the private pack.
  val invRefusedPackStaysPrivate = publication == "refused" implies not(discoverable)
  /// Correcting availability does not turn an earlier refusal into a publication.
  val invRefusalNeedsAnotherChoice =
    (_previousPublication == "refused" and not(_publicationChosen)) implies publication != "published"
  val invConnectedAvailabilityAgrees = _online implies availableOnPhone == puzzleAvailable
  /// Offline work remains available on the phone after closing and reopening.
  val invOfflineDraftIsKept = not(_online) implies draftKept
}
