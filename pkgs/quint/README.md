# @pkgs/quint

Model-based testing with [Quint](https://quint-lang.org/): draw traces from a
model, replay each one against the real thing, and require the real thing to
be in the model's state after every step. Product models live in
`specs/<domain>/*.qnt` and run in their package's `test:spec`
([`docs/SPEC_STANDARDS.md`](../../docs/SPEC_STANDARDS.md));
this package knows nothing about the product.

| Module | What it does |
| --- | --- |
| `simulate` | `quint run --mbt` on the TypeScript backend that ships in the npm package (the default Rust backend downloads a binary — no network in a gate). Seed: `FC_SEED` (default `424242`), any under `PBT_RANDOM=1`, like `assertProperty`. Checks every `val inv<Name>` while drawing; drops duplicate traces. A model's file is kebab-case, its module the same name in snake_case. |
| `itf` | The Informal Trace Format decoded into JS values (`Map`, `Set`, tuples as arrays, variants as `{ tag, value }`); `renderQuint` prints a value as Quint would, sorted, and is what equality compares. |
| `registry` | `setQuintWorld` (what a trace runs in: create, dispose, and optionally `settle` on the world's own clock and `record` each step in its report) and `bindQuintModel` (one action per Quint action, `init` included, and `observe`, which reads the model's variables back). |
| `replay` | One trace against a world and a binding; a divergence names the step, the variables that differ and the world calls the step made. `untakenActions` finds bound actions no trace took. |
| `bun-test` / `stubs` | One `describe` per model, one `test` per trace, one that fails when a bound action is never taken; the generated stub the spec runner writes per model. |

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
