# @pkgs/conformance

The closed-world side of acceptance specs ([`specs/README.md`](../../specs/README.md)
§§ 11–13, 18–19, 22–23, 25.3): machine evidence every spec runner records,
the conformance manifest that says what a release must prove, and the pure
checks that the manifest and the repository describe the same product with
every entry of it proven automatically. This package knows nothing about the
product; a repository supplies the facts and its own evidence map.

| Module | What it does |
| --- | --- |
| `evidence` | `EvidenceRecord` (a spec's uri, kind, text hash, package and obligations) and `Obligation` (`id`, `layer`, `pass` or `fail` — no third status). `SPEC_KINDS`, `LAYERS`, `sha256`, `isEvidenceRecord`. |
| `evidence-store` | `recordEvidence(reportDir, record)` writes one file per decided set of obligations under `<reportDir>/evidence/` (atomic, never read-merge-write); `readEvidence(reportDir)` merges them back into one record per spec text and lists malformed files. |
| `manifest` | `parseManifest(yaml)` → the typed manifest (keys as in the file, spaces included) or every issue: unknown or missing keys, duplicate ids, a capability or contract outside `product.contexts`, a kind of spec other than `required`, `manual testing allowed` other than `false`, an unknown requirement, a `fail on` missing any non-pass state. |
| `proofs` | `Proof` (`{ spec }`, `{ live }`, `{ task }`, `{ kind }`, `{ line }`) and `EvidenceMap` — what a repository says proves each environment, public contract, release gate and readiness requirement — and `proofProblem`: a named spec exists and is bound (and runs where it is claimed to), a task is reached by the release gate, a kind has a spec, a report line exists. |
| `closure` | `closureProblems(world)`: contexts are exactly the spec directories; capabilities and decision tables name each other exactly; every required kind has a spec and every spec is bound; every objective measures a context; the evidence map covers exactly the manifest's ids and every proof is automated; each public contract is proven in its own context. Pure over plain facts (`ClosureWorld`). |

The repository's gate (`@libs/tools-harness-ts#ci:conformance`,
`libs/tools-harness-ts/scripts/verify-conformance.ts`) reads the facts and runs
`closureProblems`; its report (`bun run conformance`) turns recorded evidence
into the pipeline's PASS/FAIL per line.
