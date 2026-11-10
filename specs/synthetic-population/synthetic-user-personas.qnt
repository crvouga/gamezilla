// Every Synthetic User in the Synthetic Population has a complete persona of
// its own: a username no other Synthetic User has, which reads like one a
// person chose, an avatar, a home region, a skill level, favorite games and a
// daily schedule. Alice, who may configure the Synthetic Population, raises
// the desired synthetic population and new Synthetic Users arrive, each with
// its persona. A Synthetic User keeps its persona when its app closes and
// reopens. A Synthetic Population of 12 or more is varied: several skill
// levels and several favorite games.
// With no connection, Alice cannot change the desired synthetic population,
// and the Synthetic Population stays as it was until her connection returns.
module synthetic_user_personas {
  /// How many Synthetic Users the Synthetic Population has.
  var populationSize: int
  /// The desired synthetic population Alice last set.
  var desiredPopulation: int
  /// No two Synthetic Users share a username.
  var usernamesDistinct: bool
  /// Every Synthetic User has a complete persona.
  var personasComplete: bool
  /// Every Synthetic User still has the persona it first had.
  var personaKept: bool
  /// At least 3 skill levels and 3 favorite games appear among the Synthetic Users.
  var populationVaried: bool
  /// Bookkeeping: the people whose device has no connection.
  var _offline: Set[str]
  /// Bookkeeping: the Synthetic Population's size when Alice went offline.
  var _populationBeforeOffline: int

  action init = all {
    populationSize' = 0,
    desiredPopulation' = 0,
    usernamesDistinct' = true,
    personasComplete' = true,
    personaKept' = true,
    populationVaried' = true,
    _offline' = Set(),
    _populationBeforeOffline' = 0,
  }

  /// Alice changes the desired synthetic population; any new Synthetic User arrives with its own persona.
  action changeDesiredPopulation(n: int): bool = all {
    not(_offline.contains("Alice")),
    desiredPopulation' = n,
    populationSize' = if (n > populationSize) n else populationSize,
    usernamesDistinct' = usernamesDistinct,
    personasComplete' = personasComplete,
    personaKept' = personaKept,
    populationVaried' = populationVaried,
    _offline' = _offline,
    _populationBeforeOffline' = _populationBeforeOffline,
  }

  /// A Synthetic User's app closes and reopens; its persona stays.
  action reopenApp = all {
    populationSize > 0,
    populationSize' = populationSize,
    desiredPopulation' = desiredPopulation,
    usernamesDistinct' = usernamesDistinct,
    personasComplete' = personasComplete,
    personaKept' = personaKept,
    populationVaried' = populationVaried,
    _offline' = _offline,
    _populationBeforeOffline' = _populationBeforeOffline,
  }

  /// Bookkeeping: a device loses its connection.
  action _loseConnection(who: str): bool = all {
    not(_offline.contains(who)),
    populationSize' = populationSize,
    desiredPopulation' = desiredPopulation,
    usernamesDistinct' = usernamesDistinct,
    personasComplete' = personasComplete,
    personaKept' = personaKept,
    populationVaried' = populationVaried,
    _offline' = _offline.union(Set(who)),
    _populationBeforeOffline' = populationSize,
  }

  /// Bookkeeping: that device's connection comes back.
  action _comeBackOnline(who: str): bool = all {
    _offline.contains(who),
    populationSize' = populationSize,
    desiredPopulation' = desiredPopulation,
    usernamesDistinct' = usernamesDistinct,
    personasComplete' = personasComplete,
    personaKept' = personaKept,
    populationVaried' = populationVaried,
    _offline' = _offline.exclude(Set(who)),
    _populationBeforeOffline' = _populationBeforeOffline,
  }

  action step = {
    nondet n = 0.to(12).oneOf()
    nondet who = Set("Alice").oneOf()
    any { changeDesiredPopulation(n), reopenApp, _loseConnection(who), _comeBackOnline(who) }
  }

  /// Two Synthetic Users never share a username.
  val invUniqueUsernames = usernamesDistinct
  /// Every Synthetic User has a complete persona.
  val invCompletePersona = personasComplete
  /// A Synthetic User keeps its persona for good.
  val invPersonaKept = personaKept
  /// A Synthetic Population of 12 or more is varied.
  val invVariedPopulation = (populationSize >= 12) implies populationVaried
  /// The Synthetic Population never shrinks below the desired synthetic population Alice set.
  val invPopulationCoversDesired = populationSize >= desiredPopulation
  /// Bookkeeping: while Alice is offline the Synthetic Population stays as it was.
  val invOfflineKeepsPopulation = _offline.contains("Alice") implies (populationSize == _populationBeforeOffline)
}
