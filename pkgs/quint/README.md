# @pkgs/quint

Model-based testing with [Quint](https://quint-lang.org/): type check a
model, model-check its invariants with Apalache over every behavior up to a
bound, then draw traces from it, replay each one against the real thing, and
require the real thing to be in the model's state after every step. Every
obligation a run decides is recorded as evidence (`@pkgs/conformance`). Product models live in
`specs/<domain>/*.qnt` and run in their package's `test:spec`
([`specs/README.md`](../../specs/README.md));
this package knows nothing about the product.

Verification may opt into `encoding: 'fun-arrays'` for models supported by
Apalache's array map encoding. It checks invariants after translating each
state's full transition choice to reduce solver work, preserving the bound and
invariant obligations. Other models retain Apalache's default settings.

| Module | What it does |
| --- | --- |
| `shape` | Static shape of an aggregate, before any trace or Apalache run: an invariant that can fail and names some state, every action reached from `init` or `step`, every variable set in `init`, every observable variable named by an invariant, and an offline-first connection (one device starts connected, can lose the connection and get it back, and some invariant says what that changes). `events.qnt` is not an aggregate. |
| `verify` | `quint verify` with Apalache: every listed invariant in every state reachable within `maxSteps` steps — all actions, all drawn values, all interleavings — or a counterexample. `{ ok: true, durationMs }` or `{ ok: false, output }`; no invariants is a failure. Each check starts its own Apalache server on a free port, in its own process group with `outDir` as its working directory (so `_apalache-out/` lands there), and kills the group when Quint exits or `timeoutMs` passes. |
| `apalache` | Where Apalache comes from: `$APALACHE_HOME`, else `mise where http:apalache` (0.56.1, pinned in `mise.toml`; the JVM from `mise where java` goes first on `PATH`). Each check gets a private `QUINT_HOME` whose `apalache-dist-0.56.1/apalache` links to it, so Quint never downloads one; its HTTP proxy is a dead local port as a second wall. Missing: run `mise install`. |
| `simulate` | `quint run --mbt` on the TypeScript backend that ships in the npm package (the default Rust backend downloads a binary — no network in a gate). Seed: `FC_SEED` (default `424242`), any under `PBT_RANDOM=1`, like `assertProperty`. Checks every `val inv<Name>` while drawing; drops duplicate traces. A model's file is kebab-case, its module the same name in snake_case. |
| `itf` | The Informal Trace Format decoded into JS values (`Map`, `Set`, tuples as arrays, variants as `{ tag, value }`); `renderQuint` prints a value as Quint would, sorted, and is what equality compares. |
| `registry` | `setQuintWorld` (what a trace runs in: create, dispose, and optionally `settle` on the world's own clock and `record` each step in its report) and `bindQuintModel` (one action per Quint action, `init` included, and `observe`, which reads the model's variables back; `verifySteps`, default 4, bounds the model check — its cost grows steeply with the bound). |
| `replay` | One trace against a world and a binding; a divergence names the step, the variables that differ and the world calls the step made. `untakenActions` finds bound actions no trace took. |
| `bun-test` / `model-checks` / `stubs` | One `describe` per model: shape and `type checks` (slice 0) before any trace is drawn, then one `test` per trace, one that fails when a bound action is never taken or when the model has no invariant, one that a trace replays twice to the same end state (with a `fingerprint`); the generated stub the spec runner writes per model. Apalache stays in the package's `check:models`. |
| `model-evidence` | Evidence (`kind: 'dynamics'`) in `<reportDir>/evidence/`, recorded by each test as it decides: `shape`, `typecheck`, `verify`, `simulate` (specification), `trace:<n>`, `determinism` (implementation), `bound-actions` (completeness). A failed obligation also fails its test. |

```ts
bindQuintModel<Door>({
  model: 'door',            // tests/fixtures/door.qnt
  traces: 6,
  maxSteps: 8,
  actions: {
    init: async () => {},
    open: async (d, picks) => d.open(String(picks['who'])),
    // …one per action the model takes
  },
  observe: async (d) => ({ state: d.state, lastBy: d.lastBy }),
});
```

The product world is `useQuintHarness(openHarness)` in `@libs/harness/quint/world`.
