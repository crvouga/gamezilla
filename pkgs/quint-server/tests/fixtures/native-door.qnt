// @spec-meta — Native Quint instantiation is the oracle for the closed compiler input.
module native_door {
  import parameterized_door(LOCKED = false).* from "./parameterized-door"
  val invNative = invKnownState
}
