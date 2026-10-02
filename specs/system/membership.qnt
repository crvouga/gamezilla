// @spec-interpretation
// Sources: specs/billing
// Billing precedence and time boundaries. Units are days; representative
// periods explore both sides of the seven-day grace boundary.
module membership {
  import universe.* from "./universe"
  export universe.*
  type MembershipStanding = { status: str, period: int }
  type MembershipState = { rows: (int, int) -> MembershipStanding }
  pure val billingPROVIDERS = Set(0, 1)
  pure val billingSTATUSES = Set("incomplete", "trialing", "active", "delinquent", "ended", "unreadable")
  pure val billingGRACE = 7
  pure val billingInitial: MembershipState = { rows: tuples(PEOPLE,billingPROVIDERS).mapBy(_ => { status: "incomplete", period: -1 }) }
  pure def billingRank(r: MembershipStanding): int =
    if (r.status == "active") 4 else if (r.status == "trialing") 3
    else if (r.status == "delinquent") 2 else if (r.status == "incomplete") 1
    else if (r.status == "ended") 0 else -1
  pure def billingGoverning(s: MembershipState, p: int): MembershipStanding = {
    val a = s.rows.get((p, 0))
    val b = s.rows.get((p, 1))
    if (billingRank(a) > billingRank(b) or (billingRank(a) == billingRank(b) and a.period >= b.period)) a else b
  }
  pure def billingGrants(r: MembershipStanding, now: int, confirmed: int): bool = and {
    not(Set("incomplete", "unreadable").contains(r.status)),
    confirmed == -1 or now <= confirmed + billingGRACE,
    Set("active", "trialing").contains(r.status) or (r.period != -1 and now <= r.period + billingGRACE),
  }
  pure def billingPaid(s: MembershipState, p: int, now: int, confirmed: int): bool = billingGrants(billingGoverning(s, p), now, confirmed)
  pure def billingChange(s: MembershipState, p: int, provider: int, status: str, period: int): MembershipState =
    { ...s, rows: s.rows.set((p, provider), { status: status, period: period }) }
  pure def billingValid(s: MembershipState): bool =
    s.rows.keys() == tuples(PEOPLE,billingPROVIDERS) and s.rows.keys().map(k => s.rows.get(k)).forall(r => billingSTATUSES.contains(r.status) and r.period >= -1)
}
