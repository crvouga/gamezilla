// @spec-interpretation
// Sources: specs/billing
// Boundary classes preserve before/at/after grace. Online authority is never
// constrained by device confirmation age; offline devices are.
module membership_machine {
  import membership.* from "./membership"
  var state: MembershipState
  var now: int
  var confirmed: int
  var cached: MembershipState
  var online: bool
  action init = all { state' = billingInitial, now' = 0, confirmed' = 0, cached' = billingInitial, online' = true }
  action change(status: str, period: int, provider: int): bool = all {
    state' = billingChange(state,0,provider,status,period),
    now' = now, confirmed' = confirmed, cached' = cached, online' = online,
  }
  action tick: bool = all { now' = now + 1, state' = state, confirmed' = confirmed, cached' = cached, online' = online }
  action disconnect: bool = all { online, online' = false, state' = state, now' = now, confirmed' = confirmed, cached' = cached }
  action reconnect: bool = all { not(online), online' = true, state' = state, now' = now, confirmed' = confirmed, cached' = cached }
  action confirm: bool = all { online, confirmed' = now, cached' = state, state' = state, now' = now, online' = online }
  action step = {
    nondet provider = billingPROVIDERS.oneOf()
    nondet status = billingSTATUSES.oneOf()
    nondet period = Set(-1,0,2,4).oneOf()
    any { change(status,period,provider), tick, disconnect, reconnect, confirm }
  }
  val invWellFormed = billingValid(state) and billingValid(cached)
  val invStaleAccessExpires = now > confirmed + billingGRACE implies not(billingPaid(cached,0,now,confirmed))
  val invRefundEndsAccess = billingGoverning(state,0).status == "ended" and billingGoverning(state,0).period == -1
    implies not(billingPaid(state,0,now,-1))
  val invCurrentLiveGrants = Set("trialing", "active").contains(billingGoverning(state,0).status)
    implies billingPaid(state,0,now,-1)
  val invDeadMembershipLapses = Set("ended", "delinquent").contains(billingGoverning(state,0).status) and
    now > billingGoverning(state,0).period + billingGRACE implies not(billingPaid(state,0,now,-1))
  val invSafety = and { invWellFormed, invStaleAccessExpires, invRefundEndsAccess, invCurrentLiveGrants, invDeadMembershipLapses }
}
