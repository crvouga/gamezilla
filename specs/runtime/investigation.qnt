// @model-profile: local
// The team can read a recent trail, cannot read one that expired or was never
// written, and a person is never shown a trail.
module investigation {
  /// Whether the team is looking at a trail.
  var shownToTeam: bool
  /// Whether a person is looking at a trail. Always false.
  var shownToPerson: bool
  /// "none" when the team is reading, otherwise "expired", "nothing", or "refused".
  var reason: str

  action _put(team: bool, person: bool, why: str): bool = all {
    shownToTeam' = team,
    shownToPerson' = person,
    reason' = why,
  }

  action init = _put(false, false, "nothing")

  /// A trail from the last 30 days is readable by the team.
  action teamReadsRecent: bool = _put(true, false, "none")

  /// A trail 30 days old cannot be read.
  action teamReadsExpired: bool = _put(false, false, "expired")

  /// A trail that was never written cannot be read.
  action teamReadsNothing: bool = _put(false, false, "nothing")

  /// A person looking for a trail is refused, even when one exists.
  action personLooks: bool = _put(false, false, "refused")

  action step = all {
    any {
      teamReadsRecent,
      teamReadsExpired,
      teamReadsNothing,
      personLooks,
    }
  }

  /// People never see a trail.
  val invPeopleNeverSeeATrail = not(shownToPerson)

  /// The team is reading a trail only when it has not expired, gone missing, or been refused.
  val invOnlyAFreshTrailIsRead = shownToTeam implies (reason == "none")

  /// The reason is one the team or a person can be told.
  val invReasonIsKnown = or {
    reason == "none",
    reason == "expired",
    reason == "nothing",
    reason == "refused",
  }
}
