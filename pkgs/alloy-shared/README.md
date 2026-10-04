# @pkgs/alloy

Structural invariants with [Alloy 6](https://alloytools.org/): who owns what,
cardinalities, uniqueness, no cycles. Product models live in
`specs/<context>/*.als`; this package (a) model-checks every `check` and `run`
in a model within its scopes and (b) audits snapshots of persisted state — a
server Postgres, a device SQLite, projected by product adapters into atoms and
relations — by asking Alloy whether each snapshot is a legal world of the
model. Alloy is the oracle: nothing here evaluates relational logic. This
package knows nothing about the product.

Alloy and Java are pinned in `mise.toml` (`mise install`). The jar is
`ALLOY_JAR`, else `$(mise where http:alloy)/alloy.jar`; java is
`$JAVA_HOME/bin/java`, else `java` on `PATH`, else mise's. A JVM starts in
about a second, so every call is batched: one per model check, one per
adapter's snapshots.

| Module | What it does |
| --- | --- |
| `alloy-cli` | `execAlloy({ source, name, workDir?, command? })`: writes the source, runs `alloy exec` once (every command, or those a glob matches), returns each command's result and the model's sigs. Alloy's syntax and type errors are thrown verbatim (without Java stack frames); 120 s timeout. `probeSigs` reads the sigs without running the model's commands. |
| `receipt` | Pure parser of Alloy's `receipt.json`. `commandVerdict`: a `check` holds when no counterexample exists within its scope, a `run` when an instance does; a declared `expect` decides instead. `solutionSummary` trims the instance Alloy printed to the model's relations. |
| `sigs` | The sig hierarchy (`extends`, `in`, `abstract`, `one`/`lone`/`some`, `var`, `enum`) read from the source, joined with the receipt's fields and types. |
| `snapshot` | `Snapshot = { label, atoms: { Sig: ids }, relations: { field or 'Sig.field': tuples } }` (tuples start with the owning atom). `snapshotProblems` (unknown sig or field, wrong arity, an atom no sig declares or of the wrong sig, duplicate ids, `one`/`lone`/`some` counts, ambiguous field names); `modelProblems` (`var` sigs and fields and Int-valued fields cannot be pinned); `snapshotPredicate` (below). |
| `atom-id` | `alloyAtomId`: any stored id as an Alloy identifier, deterministic and injective (`s-1` → `atom_s_2d_1`). |
| `audit` | `auditSnapshots({ modelSource, snapshots, sigs? })` → `{ label, legal, problems }[]` in one JVM; `illegalSnapshotReport` names each illegal snapshot with its atoms and relations. The comparison the bridge gates on — call it from a product package to prove a corrupted snapshot is caught. |
| `registry` | `bindStructure({ spec: '<stem>', snapshots: { '<adapter>': async () => Snapshot[] } })`, one per spec, in `tests/structure/<stem>.binding.ts`, imported from `tests/structure/index.ts`. |
| `bun-test` / `stubs` | `runStructureSpec`: one `describe` per spec; `every check holds and every run has an instance`, then `every <adapter> snapshot is a legal world` per adapter (zero snapshots fails: no evidence). Records evidence (`kind: 'structure'`; `command:<name>` in `specification`, `snapshots:<adapter>` in `implementation`) and leaves Alloy's inputs and receipts in `<reportDir>/alloy/<stem>/`. The generated stub the spec runner writes per spec (`specs/spaces/spaces.als` → `spaces-spaces.als.test.ts`). |

A snapshot is pinned by a predicate appended to the model's own text, so every
fact and field multiplicity applies — Alloy finds an instance iff the snapshot
is a legal world. Every sig is pinned to exactly its atoms (a parent to its own
and its subsigs'), every field exactly (`no f` when empty; `(Sig <: f)` when
two sigs declare `f`), and every non-subset sig scoped to exactly its count:

```alloy
pred snapshot_0 {
  some disj atom_alice, atom_bob: Person, disj atom_s_2d_1: Space |
    Person = atom_alice + atom_bob
    and Space = atom_s_2d_1
    and host = atom_s_2d_1->atom_alice
    and members = atom_s_2d_1->atom_alice + atom_s_2d_1->atom_bob
}
run snapshot_0 for exactly 2 Person, exactly 1 Space
```

```ts
// tests/structure/spaces.binding.ts
bindStructure({
  spec: 'spaces', // specs/spaces/spaces.als
  snapshots: {
    'server database': async () => [await serverSnapshot(seededDb)],
    'device database': async () => [await deviceSnapshot(seededSqlite)],
  },
});

// a mutation test in the product package
const [verdict] = await auditSnapshots({
  modelSource: readFileSync('specs/spaces/spaces.als', 'utf8'),
  snapshots: [withTwoHosts(await serverSnapshot(seededDb))],
});
expect(verdict?.legal).toBe(false);
```

Limits: sigs of opened modules (`util/ordering`) are left unpinned; the
predicates are named `snapshot_<i>` and atoms `atom_<id>`, so a model should
not use those prefixes itself (a clash is reported).
