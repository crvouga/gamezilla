// @spec-interpretation
// Sources: specs/auth, specs/profile
// Link proposals and consent, including duplicate and conflicting claimants.
module identity_machine {
  import identity.* from "./identity"
  import universe.* from "./universe"
  export universe.*
  var state: IdentityState
  var priorOwners: int -> int
  var violation: bool
  action init = all { state' = authInitial, priorOwners' = authInitial.identityOwner, violation' = false }
  action move(s: IdentityState): bool = all {
    state' = s, priorOwners' = state.identityOwner,
    violation' = (violation or state.identityOwner.keys().exists(i => state.identityOwner.get(i) != -1 and s.identityOwner.get(i) != state.identityOwner.get(i))),
  }
  action step = {
    nondet p = PEOPLE.oneOf()
    nondet i = authIDENTITIES.oneOf()
    nondet trusted = Set(false,true).oneOf()
    any {
      move(authPropose(state,i,p,trusted)), move(authConfirm(state,i,p)),
      move(authUnlink(state,i,p)), move(authExpireProposals(state)), move(authRevoke(state,p)), move(authErase(state,p)),
      all { authUsable(state,p), move(authRegister(state,p)) },
    }
  }
  val invSafety = authValid(state) and not(violation)
}
