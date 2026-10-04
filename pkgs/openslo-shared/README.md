# @pkgs/openslo

Quantitative product objectives in [OpenSLO](https://openslo.com/) v1:
check that an objective file is well-formed, then evaluate each objective
against measurements a product adapter supplies — a harness run at check
time, live telemetry or synthetics at release time. Product files live in
`specs/<context>/<name>.openslo.yaml` (strategy § 9, § 4.1); this package
knows nothing about the product and never interprets a metric source.

| Module | What it does |
| --- | --- |
| `parse` | `parseOpenSlo(text)` → `{ ok: true, doc: { slis, slos } }` or `{ ok: false, issues }`. Multi-document YAML (`---`) or a top-level list. Kinds `SLI` and `SLO` of `openslo/v1`; any other kind or version is an issue. Checks kebab-case names, duplicates, `indicatorRef` naming an SLI of the file (or an inline `indicator`), exactly one `timeWindow` (`^\d+[smhdw]$`; calendar windows UTC only), `budgetingMethod`, `target` (0,1] / `targetPercent` (0,100], `op`+`value` on every objective of a threshold SLI and never on a ratio SLI, `timeSliceTarget`/`timeSliceWindow` on Timeslices objectives only. Metric sources need a `type` and a non-empty `spec`, nothing more. |
| `model` | The parsed types (`Sli`, `Slo`, `Objective`, `TimeWindow`). |
| `window` | `parseDuration`, `parseStartTime`, `windowBounds(slo, nowMs)`: rolling `[now − duration, now]`; calendar `[start of the period holding now, now]`, periods tiling from `startTime`. Both ends inclusive. |
| `evaluate` | `evaluateObjective({ slo, sli, objective, measurement, nowMs })` → `{ met, observed, target, considered, detail }`. Ratio SLIs take `events` (`{ atMs, good }`), threshold SLIs `samples` (`{ atMs, value }`, good when `value <op> objective.value`). Occurrences: good / total ≥ target. Timeslices: slices of `timeSliceWindow` from the window start; a slice with data is good when its ratio ≥ `timeSliceTarget`; good slices / slices ≥ target. Nothing in the window, or the wrong kind of measurement, is not met. |
| `registry` | `bindObjectives({ spec: '<stem>', layer?, measure: { '<sli name>': (ctx) => Promise<Measurement> }, nowMs?, timeoutMs? })` and `objectivesBinding(stem)`. A measure gets `{ nowMs, startMs, endMs }` for its SLO's window; without an injected `nowMs` the window is unbounded (±Infinity) and now is the latest `atMs` measured. |
| `check` | The comparison the bridge runs, for a product's own mutation tests: `checkObjectiveSpec({ text, binding })`, `measureSlo`, `bindingIssues` (SLIs used without a measure, measures naming no SLI). |
| `bun-test` / `stubs` | `runObjectiveSpec({ packageName, specPath, specUri, reportDir })`: one `describe` per file; tests `is a well-formed objective`, `measures every indicator its objectives use`, and `<slo> meets "<objective>"` per objective. Evidence (`kind: 'objectives'`): `valid` (specification), `bound` and `objective:<slo>:<displayName>` (the binding's layer, default implementation). `sloStubFileName` / `sloStubSource` write the runner's generated stub. |

```yaml
# specs/sync-engine/note-delivery.openslo.yaml
apiVersion: openslo/v1
kind: SLI
metadata:
  name: note-delivery-time
spec:
  thresholdMetric:
    metricSource:
      type: product
      spec:
        sample: milliseconds from save to the last open device showing the note
---
apiVersion: openslo/v1
kind: SLO
metadata:
  name: note-delivery-latency
spec:
  service: sync-engine
  indicatorRef: note-delivery-time
  timeWindow:
    - duration: 1d
      isRolling: true
  budgetingMethod: Occurrences
  objectives:
    - displayName: p95 under 200 ms
      op: lt
      value: 200
      target: 0.95
```

```ts
// ../openslo-server/tests/openslo/note-delivery.binding.ts, imported from ../openslo-server/tests/openslo/openslo.ts
bindObjectives({
  spec: 'note-delivery',
  measure: {
    'note-delivery-time': async ({ startMs, endMs }) => ({
      kind: 'samples',
      samples: await deliveryTimes(startMs, endMs), // the product adapter
    }),
  },
  nowMs: () => clock.now(),
});
```

`../openslo-server/tests/mutation.test.ts` shows the fault-seeding the strategy asks for
(§ 21): slower delivery breaks the latency objective, an error burst breaks
the success and hourly objectives, and a child `bun test` of the generated
stub fails against the degraded product.
