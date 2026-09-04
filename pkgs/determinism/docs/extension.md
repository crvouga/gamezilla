You are extending `@pkgs/determinism`, the opinionated deterministic simulation + PBT framework described in the attached README.

Your goal is to evolve it into a **deterministic systems verification framework** where consumers who provide a richer set of semantic hooks/contracts get, from the same system definition:

1. deterministic simulation testing (DST)
2. property-based testing (PBT)
3. model-based testing
4. systematic model checking
5. generated formal specifications / formal verification checks
6. implementation-vs-model refinement checking

The central architectural requirement is:

> **Consumers should describe their system semantics once. The framework should derive all testing/verification modes from that description.**

Do NOT create separate consumer-facing DSLs for PBT, model checking, formal verification, etc.

---

# 1. First: inspect the repository

Before changing code:

* inspect the entire `@pkgs/determinism` package
* inspect all tests
* inspect `acme-kv`
* inspect at least one real consumer such as sync-engine
* inspect the existing action/model/DST/trace architecture
* identify exactly where the current `SystemDef`, `ActionDef`, `World`, scheduler, network, trace, scenario, and PBT layers live
* understand existing public/private API boundaries

Then produce an implementation plan internally and implement it.

Preserve the package's existing design philosophy:

* framework owns the World
* kinds are values
* one action list
* no global registries
* no package-local simulation DSLs
* no `match` catch-all action routing
* SimDeps remain harness-only
* no product dependency on `@pkgs/determinism`
* no second SimDeps created inside node boot
* roles rather than hardcoded client/server concepts
* no shims
* no `@deprecated` aliases
* no parallel APIs for the same concept

Do not weaken existing determinism guarantees.

---

# 2. The conceptual architecture

Evolve the framework toward:

```text
                         System semantics
                               │
             ┌─────────────────┼──────────────────┐
             │                 │                  │
             ▼                 ▼                  ▼
        executable          abstract           formal
          model              model             specification
             │                 │                  │
             ▼                 ▼                  ▼
           DST             model checking       TLA+
             │                 │                  │
             └────────┬────────┴──────────────────┘
                      ▼
                 same properties
                      │
                      ▼
                 PBT + MBT
                      │
                      ▼
              implementation
```

The framework should have one semantic source of truth wherever possible.

The consumer should primarily specify:

* state
* initial state
* action preconditions
* abstract state transition
* observation/projection
* postconditions/invariants
* action generation
* environment transitions
* liveness/convergence conditions
* refinement/abstraction boundaries

The framework derives:

* PBT command models
* model-based execution
* model exploration
* bounded model checking
* formal specification
* implementation/model comparison

---

# 3. Introduce an explicit semantic model

The existing `SystemDef.model` is currently primarily used by `fc.asyncModelRun`.

Expand this concept into a first-class **SystemModel**.

Conceptually:

```ts
type SystemModel<M, S> = {
  initial: (context: ModelContext<S>) => M

  actions: ModelAction<M, S>[]

  invariant?: ModelInvariant<M, S>[]

  observe?: (state: S) => M

  equivalent?: (expected: M, actual: M) => boolean

  normalize?: (model: M) => unknown

  terminal?: (model: M) => boolean

  progress?: ProgressProperty<M, S>[]

  abstraction?: AbstractionDef<M, S>
}
```

Do not blindly copy this exact API. Design it according to the repository's existing type architecture.

The important distinction is:

```text
M = abstract/reference model state

S = actual system state
```

The framework must not assume the abstract model is the same thing as the live World.

---

# 4. Upgrade actions into semantic actions

The existing:

```ts
defineAction({
  kind,
  class,
  arb,
  dispatch,
  allows,
  apply,
})
```

is already close to the correct foundation.

Extend it so that one action can describe:

```text
generation
  +
precondition
  +
abstract transition
  +
real dispatch
  +
observation/effect
  +
postcondition
```

Conceptually:

```ts
defineAction({
  kind: 'put',
  class: 'domain',

  arb: ...,

  allows(model, action) {
    ...
  },

  apply(model, action) {
    ...
  },

  dispatch(world, action) {
    ...
  },

  assert?: {
    post?: ...
    invariant?: ...
  }
})
```

Again, use the repository's actual conventions rather than blindly adding this exact shape.

The critical rule:

> An action must have enough semantics for the framework to execute it against both the real system and the abstract model.

---

# 5. Separate action semantics from action execution

Introduce a conceptual distinction between:

```text
Action
Action semantics
Action execution
```

The same action should be usable by:

### PBT

```text
generate → allows → apply model → dispatch world
```

### Model-based testing

```text
generate → choose legal action → apply model
```

### Model checking

```text
enumerate legal actions → transition abstract state
```

### Formal specification

```text
action → formal transition relation
```

Do not make consumers duplicate these definitions.

---

# 6. Add model-based testing

Build a first-class model-based runner.

It should support:

* generated action sequences
* model state
* actual World state
* legal-action filtering
* abstract transition
* execution against actual World
* observation of actual World
* comparison against abstract model
* shrinking
* deterministic replay

Conceptually:

```ts
assertModelBased(system, {
  numRuns,
  maxCommands,
  ...
})
```

Do not necessarily use that exact API.

The runner should execute:

```text
model state
    ↓
choose legal action
    ↓
apply action to model
    ↓
dispatch same action into World
    ↓
settle/observe as appropriate
    ↓
compare model vs implementation
```

Important:

The model must NOT be treated as a live convergence oracle during network loss.

Preserve the existing README contract:

> Model hooks are a command filter / shrink aid, not a live oracle under loss.

The framework should support explicit observation points where comparison is valid.

For sync systems, this will commonly be after:

```text
settle()
```

or after an explicitly declared observation barrier.

---

# 7. Introduce explicit observation/refinement semantics

This is extremely important.

The abstract model will usually not contain all implementation details.

Therefore consumers need to say how actual state maps into abstract state.

Introduce something conceptually like:

```ts
abstraction: {
  observe(world): ModelState
}
```

or an equivalent mechanism consistent with the package architecture.

Example:

```ts
model.observe = async (world) => ({
  serverValue: await world.node(...),
  clientValues: ...
})
```

Then compare:

```text
abstract model
      ↓
expected semantic state

actual World
      ↓
observation/projection
      ↓
actual semantic state
```

Support:

```ts
equivalent(expected, actual)
```

for cases where representation differs.

This is the foundation for refinement checking.

---

# 8. Add systematic model checking

Implement a model-checking engine over the abstract model.

Do NOT model-check the entire TypeScript World directly.

The model checker should operate over the small finite semantic model.

Support:

* BFS
* DFS
* configurable maximum depth
* state deduplication
* canonical state hashing
* action enumeration
* legal-action filtering
* invariant checking
* terminal states
* counterexample traces
* bounded liveness/progress checks where practical

Conceptually:

```ts
checkModel(system, {
  maxDepth,
  maxStates,
  invariants,
})
```

The engine should explore:

```text
initial state
   ├── action A
   │    ├── action A
   │    ├── action B
   │    └── action C
   │
   ├── action B
   │    ├── action A
   │    ├── action B
   │    └── action C
   │
   └── action C
        ...
```

with state deduplication.

A discovered failure must produce a minimal/reduced counterexample whenever possible:

```text
seed/model configuration
initial state
action 1
action 2
...
action N
failure
```

The counterexample must be convertible into an existing framework scenario so that it can be replayed against the real DST implementation.

This is a critical integration requirement:

> **Every model-checking counterexample should be executable by the normal DST runner.**

---

# 9. Model environment nondeterminism explicitly

The existing DST framework has important nondeterminism:

* scheduler ordering
* network delay
* message loss
* duplication
* partitions
* holds
* releases
* crashes/restarts
* timers
* faults
* seeded entropy

Model checking must be able to represent relevant environment choices.

Do not reduce the model to only domain actions.

Introduce semantic environment actions/events where appropriate:

```text
DomainAction
NetworkDeliver
NetworkDrop
NetworkDuplicate
Partition
Heal
Crash
Restart
AdvanceTime
TimerFire
...
```

However, do NOT automatically expose every internal scheduler implementation detail.

Consumers should declare which nondeterministic/environment transitions are semantically relevant to their protocol.

This allows:

```text
DST:
  realistic large execution space

Model checker:
  exhaustive bounded semantic execution space
```

without exploding the model with irrelevant implementation details.

---

# 10. Add state canonicalization

Model checking requires robust state equality.

Add an explicit canonicalization layer.

The framework should support:

```ts
model.hash(state)
```

or equivalent.

Do not rely on:

* object identity
* property insertion order
* JSON.stringify accidentally being canonical
* locale-dependent ordering
* unstable serialization

Reuse the package's existing deterministic/canonical JSON facilities where appropriate.

The canonical representation must itself be deterministic.

---

# 11. Add formal specification generation

Add a formal-specification layer.

The first target should be **TLA+**.

Do NOT attempt to translate arbitrary TypeScript into TLA+.

Instead, generate a TLA+ specification from the semantic model:

```text
SystemDef
   ↓
semantic model
   ↓
TLA+ AST / intermediate representation
   ↓
TLA+ source
```

Generate:

* variables
* initial state
* actions
* next-state relation
* invariants
* fairness/progress conditions where declared

The generated spec should be inspectable by the consumer.

Provide something conceptually like:

```ts
generateFormalSpec(system)
```

which emits:

```text
MySystem.tla
```

Do not require consumers to hand-write TLA+ for ordinary cases.

---

# 12. Do not pretend TLA+ proves TypeScript correctness

This distinction must be explicit in the API/documentation.

TLA+/TLC verifies the **formal model**.

It does not automatically prove the production TypeScript implementation conforms to it.

Therefore the framework must provide a refinement path:

```text
TLA+ model
      ↓
abstract semantic model
      ↓
model checker
      ↓
implementation model-based testing
      ↓
actual DST implementation
```

The framework should make this relationship explicit.

---

# 13. Add formal properties

Support at least three classes:

### Safety

Something bad never happens.

Examples:

```text
duplicate mutation is never committed

server revision never decreases

invalid state is never reachable

two mutually exclusive states cannot coexist
```

### Invariants

State predicates:

```ts
invariant("server revision monotonic", state => ...)
```

### Progress / liveness

Something good eventually happens.

For example:

```text
after network healing and eventual delivery,
all replicas eventually converge
```

Do NOT claim unrestricted liveness proofs unless the model provides appropriate fairness assumptions.

Represent fairness assumptions explicitly.

---

# 14. Add refinement checking

This is one of the most important features.

Given:

```text
abstract model state
actual World
```

the framework should be able to check:

```text
observe(actualWorld) ≈ abstractModel
```

at declared observation points.

For example:

```text
after domain action
after settle
after network heal
after quiescence
```

Consumers should be able to declare the valid observation boundary.

This avoids false failures caused by intentional eventual consistency.

---

# 15. Make model checking and PBT share generators

Do not maintain separate action definitions for:

```text
PBT
model checking
model-based testing
```

The same semantic action definition should support:

```text
PBT:
  randomized generation

Model checking:
  exhaustive finite enumeration

Model-based:
  randomized legal selection

DST:
  actual execution
```

Therefore introduce an action enumeration abstraction.

For example, conceptually:

```ts
arb(...)
enumerate(...)
```

If an action has an infinite domain, model checking should require either:

* an explicit finite domain
* bounded enumeration
* a model-checking-specific abstraction

Do not silently truncate infinite domains.

Make the limitation explicit.

---

# 16. Add bounded model domains

The model checker needs finite state spaces.

Add explicit bounded domains for:

* IDs
* strings
* numbers
* collections
* clients
* keys
* values
* network messages
* clocks

For example:

```ts
model.bounds({
  clients: 2,
  keys: 2,
  values: 2,
  maxQueue: 3,
  maxTime: 100
})
```

Do not make these global framework configuration.

They belong to the verification model.

The same consumer system should be able to have:

```text
PBT:
  clients 1..10

model checking:
  clients 1..2
```

because model checking requires a deliberately small finite abstraction.

---

# 17. Add partial-order reduction where useful

Concurrency creates state explosion.

The model checker should have a clean abstraction for independent actions/events.

If possible, support:

* independent-action detection
* partial-order reduction
* duplicate state elimination
* symmetry reduction
* canonicalization
* depth/state limits

Do not implement complicated optimization before establishing correct exhaustive semantics.

Correctness comes first.

---

# 18. Counterexamples must integrate with DST

A model checker failure should produce an artifact that can be fed directly into:

```ts
replay(system, scenario)
```

or the equivalent existing replay mechanism.

The artifact should include:

```text
model configuration
bounds
initial state
action sequence
environment decisions
invariant failure
formal property
```

Ideally:

```text
model-checker
      ↓
counterexample
      ↓
Scenario v1
      ↓
DST replay
      ↓
actual implementation failure
```

This is one of the highest-value features.

---

# 19. Extend Trace to cover verification

Do not create a second tracing mechanism.

Extend existing Trace v2 where necessary.

A verification trace should be able to represent:

```text
model transition
action choice
environment choice
state hash
invariant check
observation
refinement check
```

Keep existing trace semantics intact.

If trace schema changes are required, version them deliberately.

---

# 20. Integrate with existing determinism gates

All model-based/DST execution must retain:

```text
assertDeterministic
```

where applicable.

A model-checking counterexample that is later executed against DST should go through the same determinism gate.

The existing distinction must remain:

> A trace divergence means consumer nondeterminism, not a flaky test.

Do not weaken this contract.

---

# 21. Verification API

Design a coherent API rather than a collection of unrelated functions.

Something conceptually like:

```ts
verify(system, {
  mode: "model" | "model-check" | "formal",
  ...
})
```

or separate APIs if that fits the existing package better.

Possible public surface:

```text
assertModelBased
checkModel
generateFormalSpec
verify
```

But do not blindly use these names.

Follow the package's existing naming conventions.

The public API should make the progression obvious:

```text
assertSample()
assertModelBased()
checkModel()
generateFormalSpec()
```

Avoid an API where consumers must understand internal implementation concepts.

---

# 22. Verification reports

Create structured verification results.

For example:

```text
VerificationResult

status:
  passed
  failed
  inconclusive
  exhausted

statesExplored
transitionsExplored
maxDepth
invariantsChecked
counterexample
```

Distinguish:

```text
PASS
FAIL
BOUNDED
UNKNOWN
```

Do not report bounded model checking as an absolute proof.

For example:

```text
PASS — all 18,421 states explored
```

is different from:

```text
PROVEN — mathematically verified for all executions
```

---

# 23. Formal verification semantics

The package documentation must clearly distinguish:

### PBT

Randomized exploration.

### Model-based testing

Randomized comparison of implementation against an executable model.

### Model checking

Exhaustive exploration of a finite/bounded abstract model.

### Formal specification

Machine-readable mathematical description of system behavior.

### Formal verification

Verification of the formal specification against declared properties.

### Refinement testing

Checking that the real implementation conforms to the abstract model at observation points.

Never conflate these.

---

# 24. Sync-engine should be the primary stress test

Use the existing sync-engine system as the main integration target.

The resulting sync model should be capable of expressing things such as:

```text
client mutation
server receive
server commit
ack
replication
message delay
message reorder
message duplication
message loss
partition
heal
client restart
server restart
reconnect
settle
```

Properties should include appropriate examples such as:

```text
mutation IDs are not committed twice

server state remains valid

committed revisions are monotonic

replay is idempotent

after declared quiescence/settle conditions,
replicas converge

client state does not contain impossible committed state

acknowledgements correspond to valid server mutations
```

Do not assume these exact properties are correct for sync-engine. Inspect its actual protocol and encode properties that match the implementation's intended semantics.

---

# 25. acme-kv must become the canonical verification fixture

Extend `acme-kv`.

It should demonstrate all levels:

```text
PBT
DST
model-based testing
model checking
formal specification generation
```

The fixture should remain a toy test fixture and not become a reusable KV library.

The README should show the progression.

For example:

```text
defineSystem(...)
    ↓
assertSample(...)
    ↓
assertModelBased(...)
    ↓
checkModel(...)
    ↓
generateFormalSpec(...)
```

---

# 26. Test the framework itself aggressively

Add framework tests for:

### Model runner

* legal actions
* illegal actions
* model transitions
* implementation observation
* equivalence
* shrinking
* replay

### Model checker

* exhaustive state exploration
* state deduplication
* deterministic exploration
* invariant failures
* minimal counterexamples
* bounds
* finite enumeration
* deadlocks
* terminal states
* action independence if implemented

### Formal generation

* deterministic output
* correct initial state
* correct next-state relation
* action generation
* invariant generation
* fairness
* escaping/identifier safety

### Refinement

* matching model
* intentional representation differences
* failed refinement
* observation boundaries

### Counterexamples

* model failure → Scenario v1
* Scenario v1 → DST replay
* deterministic replay of counterexample

---

# 27. Preserve existing contracts

Do not break:

* `defineNodeKind`
* `defineAction`
* `defineKnob`
* `defineFault`
* `defineSystem`
* `openWorld`
* `World`
* `SimDeps`
* network edge enforcement
* scheduler determinism
* same-time entropy semantics
* quiescence probing
* trace determinism
* scenario v1
* existing PBT behavior

If a breaking API change is genuinely required, make it intentional and migrate every in-repository consumer.

No compatibility shims.

No deprecated aliases.

---

# 28. Avoid these architectural mistakes

Do NOT:

1. build a separate model DSL
2. make consumers write TLA+ manually for basic systems
3. attempt to transpile arbitrary TypeScript to TLA+
4. claim TLA+ verification proves the TS implementation
5. make the model a live oracle during eventual consistency
6. couple the verifier to client/server terminology
7. expose internal scheduler implementation details unnecessarily
8. create another trace format
9. create another scenario format
10. create another simulation runtime
11. require consumers to duplicate action definitions
12. make model checking depend on randomness
13. silently bound infinite domains
14. silently turn incomplete bounded checks into "passed"
15. introduce a huge generic verification framework unrelated to the existing opinionated design

---

# 29. Critical design goal: verification should be incremental

A consumer should be able to adopt this progressively.

Existing consumer:

```ts
defineSystem({
  ...
  model: {
    initial,
  }
})
```

gets:

```text
DST + PBT
```

Adding:

```text
allows
apply
observe
equivalent
invariants
finite action/domain bounds
```

gets:

```text
model-based testing
```

Adding sufficient finite semantic transitions gets:

```text
model checking
```

Adding formalizable properties gets:

```text
TLA+ generation / formal verification
```

Do not force every existing system to implement every hook.

Instead, expose a clear capability matrix.

For example:

```text
Capabilities

DST                 available
PBT                 available
Model-based         requires model semantics
Model checking     requires finite model
Formal generation   requires formalizable model
Liveness checking   requires progress/fairness declarations
```

The framework should report missing capabilities clearly.

---

# 30. Make "more semantics → more guarantees" a core product principle

The final architecture should communicate:

```text
                    Consumer effort
                         ↑
                         │
                         │     formal properties
                         │    / finite domains
                         │   / observations
                         │  / model transitions
                         │ / action semantics
                         │/
                         └────────────────────→
                           Verification power
```

The consumer is not writing five testing systems.

They are supplying semantic information once.

The framework turns that information into increasingly powerful verification.

---

# 31. Update README and documentation

Rewrite the README architecture to include:

```text
PBT
Model-based testing
Model checking
Formal specification
Refinement checking
```

Clearly explain the distinction between them.

Add a section:

## Verification ladder

Show:

```text
DST
 ↓
PBT
 ↓
Model-based testing
 ↓
Bounded model checking
 ↓
Formal specification / verification
```

Explain precisely what each guarantees and does not guarantee.

Add a complete sync-engine example.

Add a complete `acme-kv` example.

Add documentation for bounds, invariants, observation/refinement, counterexamples, and formal generation.

---

# 32. Tooling

Prefer **TLA+ / TLC** as the initial formal backend because it is particularly well suited to distributed/concurrent protocol verification.

Do not make the core package dependent on TLA+ internals.

Create a backend-neutral internal representation:

```text
semantic model
      ↓
verification IR
      ├── model checker
      └── TLA+ generator
```

This leaves room for future backends without polluting the consumer API.

If invoking TLC requires an external executable, make this an optional verification capability.

The core DST/PBT package must continue working without Java/TLC installed.

---

# 33. Verification IR

Introduce an internal intermediate representation capable of representing:

```text
StateVariable
Constant
InitialPredicate
Action
Guard
NextState
Invariant
Fairness
Observation
Equality
Set
Sequence
Map
FiniteDomain
```

Do not expose this IR as the consumer-facing DSL unless there is a compelling reason.

The semantic TypeScript API should compile into it.

Both:

```text
model checker
TLA+ generator
```

should consume this IR.

---

# 34. Determinism of the verifier

Model checking itself must be deterministic.

Given:

```text
same model
same bounds
same configuration
```

the exploration order and resulting counterexample must be reproducible.

Do NOT use random selection in the model checker unless explicitly requested as an optional search heuristic.

Default behavior must be deterministic.

Counterexample output must therefore be stable.

---

# 35. Performance

Do not prematurely optimize.

First implement:

```text
correct state transition
state canonicalization
BFS/DFS
counterexamples
DST replay
```

Then consider:

```text
partial-order reduction
symmetry reduction
parallel exploration
persistent state structures
bitsets
compact state hashes
```

Measure before introducing complexity.

---

# 36. Final acceptance criteria

The implementation is complete only when:

### Existing behavior

All current tests pass.

### PBT

Existing PBT behavior is unchanged.

### DST

Existing deterministic replay behavior is unchanged.

### Model-based

A consumer can define one abstract model and compare generated executions against the real World.

### Model checking

A finite system can be exhaustively explored with deterministic BFS/DFS and produce counterexamples.

### Counterexamples

A model-checking counterexample can be transformed into an existing Scenario v1 and replayed through DST.

### Formal specification

The same semantic model can generate a valid TLA+ specification.

### Formal checking

If TLC is available, the generated specification can be checked automatically.

### Refinement

The framework can compare actual implementation observations against abstract model state.

### Documentation

The README makes the verification ladder and guarantees explicit.

### No duplicate DSL

Consumers do not separately author:

```text
PBT model
model-checking model
TLA+ model
DST model
```

They provide one semantic system description.

---

# 37. Most important architectural constraint

Before implementing, critically evaluate whether the existing:

```text
SystemDef
ActionDef
model
World
Trace
Scenario
```

already contain enough information to serve as the semantic foundation.

Prefer extending these concepts over introducing new top-level abstractions.

The ideal result should feel like a natural evolution of `@pkgs/determinism`, not a verification framework bolted onto it.

The package should remain highly opinionated.

The final consumer experience should approach:

```ts
const syncSystem = defineSystem({
  ...,

  model: {
    initial: ...,

    actions: ...,

    observe: ...,

    invariants: ...,

    bounds: ...
  }
})
```

followed by:

```ts
assertSample(syncSystem)
assertModelBased(syncSystem)
checkModel(syncSystem)
generateFormalSpec(syncSystem)
```

with the framework doing the difficult work.

---

# 38. Deliverables

Implement the complete feature, not merely a design document.

Deliver:

1. semantic model extensions
2. model-based runner
3. model checker
4. verification IR
5. state canonicalization
6. refinement checking
7. counterexample → Scenario v1 integration
8. formal specification generation
9. optional TLC integration
10. verification reports
11. framework tests
12. acme-kv demonstration
13. sync-engine demonstration/migration
14. README/documentation updates
15. all necessary TypeScript types
16. package exports
17. verification commands/scripts

At the end, run the full relevant test suite and typechecking.

Report:

* files changed
* public API added
* existing contracts preserved
* any intentional breaking changes
* model-checking capabilities
* formal-verification capabilities
* limitations
* exact commands to run verification
* how `acme-kv` demonstrates the complete ladder
* how sync-engine uses the new capabilities

Do not stop at pseudocode or architecture recommendations. Implement the system end-to-end.


# Breaking Changes and Hard Cutovers

This project explicitly prefers **breaking changes and hard cutovers** over backward compatibility.

The package is intentionally highly opinionated. Do NOT preserve an existing API merely because it already exists.

When the new verification architecture exposes a better abstraction:

* change the existing API
* migrate every consumer
* delete the old API
* update all tests
* update documentation
* update examples
* update package exports
* update fixtures
* update downstream system definitions

Do **not** create compatibility layers.

Specifically, do NOT introduce:

* `@deprecated` aliases
* backwards-compatible overloads
* compatibility wrappers
* adapter APIs whose only purpose is preserving the old interface
* duplicate old/new concepts
* feature flags for permanently supported old behavior
* transitional `v1`/`v2` APIs unless versioning is genuinely required for persisted artifacts/protocol compatibility
* optional parameters whose only purpose is supporting legacy consumers
* parallel ways of expressing the same semantic concept

If an existing abstraction is insufficient for model-based testing, model checking, or formal verification, **redesign it rather than layering another abstraction on top of it**.

The desired migration philosophy is:

```text
old API
   ↓
DELETE
   ↓
new canonical API
   ↓
migrate all consumers
   ↓
tests enforce the new architecture
```

not:

```text
old API ───────────────┐
                       ├── compatibility layer
new API ───────────────┘
```

## Hard-cutover rule

If there is a conflict between:

1. preserving an existing API, and
2. achieving a cleaner unified semantic model,

choose the unified semantic model.

If `SystemDef.model`, `ActionDef`, `invariants`, `settle`, `Trace`, or any other existing abstraction needs to change substantially, make the change.

Do not constrain the new verification architecture around historical API decisions.

## Consumer migration

Every in-repository consumer must be migrated in the same change.

At minimum inspect and migrate:

* `acme-kv`
* sync-engine
* room
* auth
* db-schema
* matchmaking
* `@sim/test`
* all system/scenario tests
* all package exports
* all documentation/examples

The repository must end in one coherent architecture.

There should be **no old architecture remaining alongside the new architecture**.

## No speculative compatibility

Do not preserve APIs "just in case."

This package is consumed internally and is explicitly designed around high buy-in and a single authorship school.

Optimize for:

* conceptual integrity
* correctness
* minimal API surface
* strong invariants
* composability
* verification power
* maintainability

rather than migration convenience.

## Breaking changes are expected

Treat breaking changes as a normal part of this package's evolution.

A successful implementation may therefore have a substantial diff.

That is acceptable and preferred if it produces a materially better architecture.

When reporting the implementation, explicitly list:

* APIs removed
* APIs changed
* APIs added
* consumers migrated
* old concepts deleted
* new canonical concepts introduced

Do not describe a breaking change as a compatibility concern to be mitigated. **Breaking changes are the migration strategy.**
