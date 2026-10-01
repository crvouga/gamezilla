# Synthetic checks

`@synthetic` marks a standing promise about a live environment. The tag is
that word and nothing else: not `@prod`, `@production`, `@health`, `@smoke`,
`@monitor`, or `@synthetic-production`. An environment is where the runner
points, never a tag, and a `.feature` file has no schedule.

The checks used to live together under `specs/health/`. Each one now sits in
the context that owns the promise. The whole feature is tagged, on the
feature line, after `@domain:`.

## What runs

| Feature | Why it is synthetic |
| --- | --- |
| `specs/runtime/reaching-the-app.feature` | People can find every address, open the app, and still reach it securely two weeks from now. |
| `specs/runtime/serving-people.feature` | The app answers, and what people saved and every setting it needs are in place. |
| `specs/runtime/declared-environment.feature` | The environment is exactly as the team planned it. |
| `specs/runtime/connected-services.feature` | Every outside service the app relies on still lets the app use it. |
| `specs/runtime/stored-files.feature` | This environment keeps its own uploads, and can keep, show and remove one. |
| `specs/runtime/request-records.feature` | The app leaves a trail the team can follow. |
| `specs/runtime/availability.openslo.yaml` | How often those checks find the app answering people. First line `# live`. Target 0.99 over 28 days. It does not gate a deploy. |
| `specs/auth/sign-in.feature` | Google sign-in is offered, and it returns to the app and the environment the person started from. |
| `specs/billing/payments.feature` | People can pay for Plus only where payments are real. The production scenario checks that the keys are the real ones. It does not charge anyone. |
| `specs/spaces/spaces.feature` | Spaces can open in this environment. |
| `specs/spaces/live-updates.feature` | What happens in a space can reach everyone in it, and a well-known password cannot listen in. |
| `specs/profile/finding-a-person.feature` | The team can find a planted person's trouble from their name, where the connection appeared, and the time on their clock. |

`specs/journeys/` stays untagged. Those journeys already run on the harness
in `bun check` and live in `bun health`. Tagging them `@synthetic` would take
them out of the harness. They are the cross-context journeys; `@synthetic` is
the standing live promise.

## Left as candidates

These matter, and they are not tagged, because they are not safe to repeat
against production as they stand:

- Journeys that host, end or join a space, solve a puzzle, or change an
  avatar. They already run live as journeys, on the synthetic monitor account,
  and they change something.
- Anything that reads a real person's data, sends a real notification, or
  takes a real payment. Paying for Plus is a configuration check, not a charge.
- Edge cases, destructive admin, and checks that are not idempotent.

Tag one of these only after it can run on a dedicated synthetic identity,
clean up after itself, and leave no real side effect.

## How to run

The environments are `dev` and `prd`. `test` means `dev`. `production` means
`prd`. There is no staging.

| Command | What it checks | Where |
| --- | --- | --- |
| `bun run synthetic` | `@synthetic` features only | dev |
| `bun run synthetic:prd` | `@synthetic` features only | production |
| `bun health` | journeys and `@synthetic` features | dev |
| `bun health:prd` | journeys and `@synthetic` features | production |
| `bun run --filter @apps/product health:objectives` | `# live` objectives | the `SECRETS_ENV` already loaded |

`bun health` is what the hourly Health workflow runs. `@synthetic` did not
add a workflow. `--synthetic` and `--objectives` together are refused.
`--target staging` is refused. `--target` sets `SECRETS_ENV` for the host
lookup inside the product script; pick the environment with `synthetic` or
`synthetic:prd` so the secrets loaded are the ones for that environment.

A failure names the scenario, the step, and the environment in the gherkin
report and the health log line. The release evidence for that run is the
observable result (`synthetic.check` as its own span is not built; the
evidence record already says which feature and scenario passed or failed).

## Safety

A synthetic check uses dedicated identities and resources, never a real
person's data. It is safe to repeat, cleans up, and does not send real
notifications, take real payments, or fulfill a real order. Host limits in
`apps/product/scripts/health.ts` keep the production-only and
observability-only scenarios off environments that cannot run them. The
specs themselves carry no host tags.

Infrastructure health, runtime invariants and OpenSLO stay their own checks.
`@synthetic` does not replace them. The availability objective is the
OpenSLO for "the app answers people"; it is `# live` so `bun check` does not
measure GitHub from the harness.
