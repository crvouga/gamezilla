# `@pkgs/sim`

Deterministic simulation testing for TypeScript. Same seed + args + action
choices ⇒ the same timeline. Packages declare a **System** that boots a typed
surface `S` behind a **Runtime**; the framework drives **Actions**, checks
**Properties**, captures **Snapshots**, and records a **Recording** for replay.
The algebra does not know about clients, browsers, SQL, rooms, or networks — a
Runtime supplies those. Root policy: [`DETERMINISM.md`](../../DETERMINISM.md).

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Runtime** | Fidelity factory (`virtualTimeRuntime` / `realTimeRuntime`) or a catalog entry from `defineRuntime`. Passed into `defineSystem` via `runtimes`; opens a Session. |
| **Session** | Kernel + ports for one node (`clock`, `timers`, `createId`, `random`, `network`, `fork`, `waitForIdle`, `advanceTime`). Harness-only. |
| **System** | `defineSystem({ name, create, runtimes, actions?, properties?, snapshots?, args?, sample? })` — recipe → `S` with catalogs declared upfront. |
| **sim `S`** | Typed surface returned by `create(session, args)`. Data only — no wait/drain methods. |
| **Action** | Named stimulus `{ enabled, weight, args?, sample?, pool?, act, is }` from `defineAction`, listed in `defineSystem({ actions })`. `action.is(checkpoint)` narrows the applied stimulus inside a property. |
| **Property** | Model-based checkpoint check `{ setup?, check(s, model, action) }` from `defineProperty`, listed in `defineSystem({ properties })`. Assert with the pre-update model; optionally return the next model. `action` is null on boot / `s.assert` / dispose. |
| **Snapshot** | Named capture `{ media?, capture }` from `defineSnapshot`, listed in `defineSystem({ snapshots })`. Value may be any type; `media` (`json` / `html` / `png` / `text` / `bytes`) controls encoding and UI. |
| **Run** | Opened by `system.run({ seed, runtime?, args?, report? })`. Drive with `apply` / `read` / `assert` / `advanceTime` / `until` / `never` / `randomActions` / `record` / `snapshot`. |
| **RunReport** | Timeline of report steps + frames for one test. Built when `report` is enabled; optionally persisted to an ObjectStore (`runs/<runId>/tests/<testId>/report.json` + `frames/`). |
| **record** | `s.record({ kind, title, selector?, actorId? }, fn)` — one labeled report step. Steps nest: `record` / `apply` inside an open step become its children. `advanceTime` never opens a step. |
| **describe** | Optional `defineAction({ describe: (...args) => string })` — report title for `s.apply`; default `name(arg, …)`. `report: false` hides a harness-only action from the timeline. |
| **fail** | `s.fail(err)` — mark the run failed for an error raised outside any step (test-body assertion). |
| **HTML report** | `writeHtmlReport({ store, runId, out, frameCss?, junitXml? })` — one standalone `index.html` (Playwright-style: test list with status filters, step tree, frame scrubber, per-actor HTML previews, JSON panes). `readRunBundle` / `renderHtmlReport` / `applyJunitOutcomes` are the pure pieces. |
| **randomActions** | Weighted random walk over the action pool (`s.randomActions`). Returns a `RandomActionsReport`. |
| **explore** | `system.explore` — search (episodes × randomActions + shrink). Throws `ExploreFailedError`. |
| **replay** | `system.replay(recording)` — re-apply a Recording / report path. |
| **Recording** | `{ version, seed, args, steps, meta }` — shrinkable repro artifact (action log, not UI frames). |
| **sample** | How explore / randomActions draws system args (`sample: () => Gen<Args>`) or action args (`sample: (s) => Gen<A>`). |
| **waitForIdle** | `session.waitForIdle()` — drain the scheduler to quiescence (also runs after each checkpoint). |
| **advanceTime** | `s.advanceTime(ms)` — virtual (or wall) clock tick as a checkpoint. Does **not** open a report step. |
| **read** | Plain `(s: S, ...args) => T`. Observed via `s.read(fn, …args)`. |

---

## Public entrypoints

| Import | Contents |
| --- | --- |
| `@pkgs/sim` | `defineSystem` / `defineAction` / `defineProperty` / `defineSnapshot` / `defineRuntime` / `virtualTimeRuntime` / `realTimeRuntime` / Recording helpers + reporting (`RunReport`, `RunReportOptions`, `writeHtmlReport`, `readRunBundle`, `parseJunit`, …) + types (`Run`, `System`, `Action`, …) |
| `@pkgs/sim/internals` | Clock / scheduler / rng / network factories. **Runtime authors only.** |
| `@pkgs/sim/fast-check` | `gen(arbitrary)`, `arbitrary(gen)`, `randomGeneratorOver`, JSON arbs |

Free `explore` / `replay` / `run` are **not** exported from the root — use
`system.explore` / `system.replay` / `system.run`. Catalog nouns use
`defineAction` / `defineProperty` / `defineSnapshot` / `defineRuntime` and are
passed into `defineSystem` upfront.

---

## Authoring

```ts
import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSnapshot,
  defineSystem,
  virtualTimeRuntime,
} from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';

export const put = defineAction({
  name: 'put',
  enabled: (s: KvSim) => s.clients.length > 0,
  weight: 3,
  args: ['client:0', 'a', '1'] as const,
  sample: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...s.clients.map((c) => c.id)),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ maxLength: 16 })
      )
    ),
  act: (s, client: string, key: string, value: string) => {
    /* ... */
  },
});

export const kv = defineSystem({
  name: 'kv',
  args: { clients: 2 },
  sample: () => gen(fc.record({ clients: fc.integer({ min: 1, max: 3 }) })),
  create(session, args: { clients: number }) {
    const server = startServer(session.fork('server'));
    const clients = range(args.clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients };
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [put],
  properties: [
    defineProperty({
      name: 'invariants',
      check: async (s) => {
        /* ... */
      },
    }),
  ],
  snapshots: [
    defineSnapshot({
      name: 'store',
      capture: (s) => s.server.dump(),
    }),
  ],
});

export const get = (s: KvSim, client: string, key: string) =>
  s.clients.find((c) => c.id === client)!.get(key);

await using s = await kv.run({ seed: 7, report: true });
await s.apply(put);
await s.apply(put, 'client:1', 'b', '2');
expect(await s.read(get, 'client:0', 'a')).toBe('1');
await s.advanceTime(100);
await s.randomActions({ steps: 20 });

await kv.explore({ episodes: 20, steps: 40, seed: 42 });
```

`create` is `(session, args) => S | Promise<S>`. Do not sample inside `create`.
Omit `sample` on the system when every episode should use `args`.

## Layout

```
src/index.ts       public algebra
src/runtime/       virtualTimeRuntime / realTimeRuntime / createRuntime (internal) / Session
src/system/        defineSystem / defineAction / defineProperty / defineRuntime / recording
src/report/        Snapshot / RunReport / RunReporter / ObjectStore persist
src/report/html/   standalone HTML report (bundle → index.html, JUnit overlay)
src/run/           run / randomActions / explore / checkpoint (internal)
src/internals/     clocks, schedulers, rng, fingerprint, json, timers
src/models/        in-process network
src/fast-check/    gen / arbitrary adapters
```

---

## Reporting

```ts
await using s = await kv.run({
  seed: 7,
  report: { store, runId: 'latest', testId: 'kv-put', title: 'puts a value' },
});
await s.apply(put, 'client:0', 'a', '1'); // step "put(\"client:0\", \"a\", \"1\")" + frame
await s.record({ kind: 'ui', title: 'tap', selector: 'testId("ok")' }, tapOk);

// later, from a script (`// @io-wall-ok`):
await writeHtmlReport({ store, runId: 'latest', out: artifactStore });
// → artifactStore `index.html`
```

Frames come only from `defineSystem({ snapshots })`; UI harnesses wrap drivers
with `@pkgs/ui-testing` `recordingDriver` so every op is a titled step. The
HTML file embeds every frame — no server, no console tab.

## Do / don't

- **Do** pass actions, properties, snapshots, and runtimes into `defineSystem` upfront.
- **Do** keep `S` as data. Reads = functions; stimuli = actions.
- **Do** put defaults on `args` and samplers on `sample`.
- **Do** wait with `s.until` / `s.never`; advance with `s.advanceTime`.
- **Do** put package tests in `tests/` (sibling of `src/`), black-box against
  package `exports`. Colocate `module.test.ts` only next to public entrypoint
  modules. Sim harness code lives in `src/sim/` and is exported as `./sim`.
- **Don't** add package-local World openers or kit DSLs around `defineSystem` /
  `run` / `explore`.
- **Don't** put `Session` / `Runtime` in product `ClientEnv` / `ServerEnv` —
  unpack ports at the composition root.
- **Don't** import `@pkgs/sim/internals` from product or sim kits.
- **Don't** read `process.env` for seeds.
- **Don't** revive `Host` / `defineHost` — a host is a named `defineRuntime` entry on `defineSystem`.
  Product hosts (`in-process`, `bun-webview`, …) live in `@apps/product/sim`, not here.
