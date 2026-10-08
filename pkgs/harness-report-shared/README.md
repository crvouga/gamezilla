# Report storage and producers

This package owns the object-store protocol shared by publication, APIs and the
[explorer](../harness-report-client/README.md). Every operation receives its
storage and time ports from its caller.

## Commit inventory

`publishInventory(store, { sha, documents })` stores every specification body
before writing `commits/<sha>/inventory.json`. Files retain their relative path,
context, type and title, including features, models, health obligations and
supporting documents. Reads validate commit identity and restrict document
access to that inventory. Inventories are independent of test-run attempts.
Document publication uses at most sixteen concurrent writes and drains them
before publishing the inventory.

## Independent report parts

`publishPart(store, part)` accepts:

```ts
{
  sha: '…',            // full 40-character commit hash
  id: 'browser-paint', // stable producer identifier
  kind: 'performance',// open category; new categories need no viewer change
  title: 'Browser paint',
  recordedAtMs: 123,
  checks: [{
    id: 'home-lcp', title: 'Home paint', status: 'passed',
    detail: 'Measured by the browser performance contract',
    specPath: 'specs/example/paint.feature',
    measurements: [{ name: 'LCP', value: 1400, unit: 'ms', limit: 2500 }]
  }]
}
```

Statuses are `passed`, `failed`, `running` or `not-run`. Empty parts are
`not-run`. Values must be finite; producer identities, statuses, commit hashes
and duplicate check identifiers are validated before publication.

Each producer writes its own content-addressed key beneath
`commits/<sha>/parts/<id>/`. The latest timestamp wins per producer. Tied
publications are deterministic and favor failure over success. A per-commit
`versions/<sha>.json` marker discovers evidence without requiring a behavior
run. Independent parts never replace or close that run.

`readParts` and `latestParts` aggregate the results. A new `kind` appears as an
additional explorer section. `specPath` connects a check to its specification;
a source-qualified check id connects it to an existing timeline. A standalone
producer can use any check id and display measurements without a timeline.

## Recorded sources

`publishSource` retains test-runner outcomes and snapshots. Optional producer
output in its local `part.json` has `{ kind, title, checks }` without commit or
publication metadata. It travels with reusable source content. Behavior sources
also retain a separate recorded-action performance output. `sourceParts` binds
these outputs to a commit and source-qualified timeline ids; the publication
adapter records each part independently.

The existing selected-attempt pointer, reusable content hashes and frame bundles
continue to own test-run publication. An empty closed run is `skipped`, never a
successful result inferred from absent evidence. Retention preserves explorer
records with the retained commit or current branch head and removes orphan
version markers along with their evidence.

Large bundles overlap at most four 4 MiB chunk uploads per source. Entry parts
retain input order even when uploads complete out of order. Backpressure bounds
buffered chunks, and failures drain started uploads without publishing an index
that names incomplete content.
