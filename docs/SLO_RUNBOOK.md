# SLO runbook

One section per service level objective, headed by its OpenSLO
`metadata.name` (the anchor every alert's `runbook_url` points at). Each
section says what the objective measures, where its target is defined, what
a breach means for people, and where to start. What the objectives promise is
in `specs/<context>/*.openslo.yaml`; how they are measured, generated and
routed is in
[`libs/observability-slo-shared-ts/README.md`](../libs/observability-slo-shared-ts/README.md#service-level-objectives);
the coverage matrix, baselines, fault-injection plan and known gaps are in
[`SLO_COVERAGE.md`](SLO_COVERAGE.md).

## Answering any alert

Every alert carries:

- `summary`: which objective (or source of evidence), how fast its budget is
  burning, and what share of the window's budget that burn spends;
- `budget_remaining`: the share of the 7-day error budget left;
- `dashboard_url`: the objective's Grafana SLO dashboard;
- `logs_url` and `traces_url`: Explore already scoped to the environment's
  server error logs and failed traces over the alert's window;
- `runbook_url`: the section below;
- `investigate_command`: the `bun obs` command to start with;
- `slice`: for a rule judged slice by slice, the route group, check or probe
  that is failing. Each failing slice is its own alert, so one broken game or
  one failing route group pages on its own even while the total looks fine.

Its labels say how it was routed: `route` is `page` (Grafana IRM pages, only
production's tier 0 and 1), or `push` (normal IRM mobile notification); `tier`, `capability` and `slo` say what it defends.

1. Open `dashboard_url` and find the slice that is failing (route group,
   check or probe): one failing slice inside a healthy total is the usual
   shape.
2. Run `investigate_command`. `bun obs last --errors --source prod` reads the
   newest failures; `bun obs find <any id>` follows one.
3. If it began with a release, ship a revert or a fix through Release.
   Never write to a production database by hand.
4. The alert resolves by itself once its short window is clean.

### Mobile delivery

Grafana IRM (Incident Response Management) receives alerts and applies the
responder's notification rules. The configured stack and responder are in
[`global.tfvars.json`](../libs/infra-shared-ts/tofu/global.tfvars.json).
Release applies routing, personal mobile rules, CI failure delivery and
independent probes after verification. Health checks configuration drift.
Branch rehearsals plan those same resources without applying them; a successful
plan alone does not establish delivery.

The responder must sign in to that stack in the Grafana mobile app, enable IRM
and allow notifications. Critical delivery also needs the phone's critical
notification permission. Follow [Grafana's mobile setup](https://grafana.com/docs/grafana-cloud/platform/mobile-app/get-started/).
Account lookup, provisioned rules and provider notification receipts are separate
evidence; no source check proves the phone received an alert.

### Failure counts

Counts alert independently of burn ratios and traffic volume. One real failure
pushes; three in five minutes page. One failed scheduled Health check notifies
at the next evaluation. Start with the alert's exact window and command.
A large healthy denominator must not suppress an individual failure.

### Integrity violations

A 100% objective has no error budget. Any observed violation pages without a
hold or traffic floor. Contain the affected action, preserve evidence and use
the linked objective runbook. A clean five-minute alert window resolves the
active notification; it does not erase the historical readiness breach.

### "A certificate people are shown expires within …"

The certificate Synthetic Monitoring was shown for the app, the API or the
broker expires within 14 days (push) or 3 days (page). See the README's
[certificate runbook](../libs/observability-slo-shared-ts/README.md#a-certificate-people-are-shown-expires).

### "No events for …" (silence)

Fires when nothing an objective is judged by was counted for a while, so
the objective cannot look perfect while nobody is measuring it. One rule
per source and expected slice:

| Source | Silent for | Usual cause |
| --- | --- | --- |
| The Health run's check results (`synthetic_check_result`) | 8 h | The Health workflow is not running: GitHub Actions budget exhausted, the schedule disabled, or the run failing before `health` records results. Read the latest Health run in GitHub Actions; the line `health: check results not recorded …` names a recording problem. |
| Synthetic Monitoring's minute checks (`probe_success`, `probe_duration_seconds`, jobs `app-shell-<env>`, `api-ready-<env>`) | 10 min | Synthetic Monitoring uninstalled, its checks disabled, its token revoked, or the free plan's monthly runs used up (stacks/bootstrap/alerting.tf). |
| Synthetic Monitoring's broker check (`broker-<env>`) | 40 min | As above, for the ten-minute check. |
| Scheduled background work (`outbox_drain_runs_total`) | 15 min | The Worker's scheduled trigger is not running, or its telemetry is not exported. See also "Telemetry heartbeat is absent". |
| People's requests and saves | 1 day | Nobody used the app for a day, or the server's metrics stopped reaching the backend. Warning only. |

## the-app-is-always-reachable

**Measures.** Grafana Synthetic Monitoring opens `https://www.<host>/` (it
must show the app's own page, fetched fresh past any edge cache) and
`https://api.<host>/api/health/ready` (it must answer `"status":"pass"`,
which needs the database to answer) every minute in production, every hour
elsewhere, from Oregon. The share of one-minute slices in which every check
passed.

**Target and window:** [the-app-is-always-reachable](../specs/runtime/always-reachable.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** People cannot open the app, or the API cannot reach what
people saved.

**First steps.** The alert's `slice` names the job. `app-shell-<env>`
alone: the web client release or Cloudflare in front of it.
`api-ready-<env>` alone: the API Worker (`bun obs platform --service
<worker-name>`) or the database (the readiness answer names the failing
check and its time). Both: DNS, TLS or Cloudflare. The fast burn holds six
minutes before it pages, so a lone flaky probe does not page.

## the-app-opens-quickly

**Measures.** The same minute checks, by how long each took end to end
(DNS, connect, TLS, request, answer; `probe_duration_seconds`): the share of
minutes in which every check finished within 1 s.

**Target and window:** [the-app-opens-quickly](../specs/runtime/always-reachable.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Opening the app is slow for people, before their own
requests are many enough to show it.

**First steps.** The `slice` names the check. Readiness slow while the
shell is quick: the Worker or the database (`bun obs slow --source prod`).
Both slow: DNS, TLS or the edge.

## the-app-never-hangs-on-opening

**Measures.** The same, within 2.5 s.

**Target and window:** [the-app-never-hangs-on-opening](../specs/runtime/always-reachable.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Opening the app hangs for people.

**First steps.** As above.

## the-app-answers-people

**Measures.** The Health run's `runtime.reaching-the-app` and
`runtime.serving-people` checks: the share of checked hours in which both
passed.

**Target and window:** [the-app-answers-people](../specs/runtime/availability.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** In several recent runs the team could not open the app or
the app did not answer it like a person.

**First steps.** The failing Health run's log names the scenario; `bun
health` dispatches a fresh run and blocks on its verdict.

## people-can-sign-in

**Measures.** The Health run's `auth.sign-in` check, by the hour.

**Target and window:** [people-can-sign-in](../specs/auth/signing-in.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** A step of signing in with Google that the team can follow
from outside (offered, handed to Google with the way back, Google agreeing to
send people back, the person told whether it worked) failed in at least two
runs in a row (the page) or in more than 3% of the week's runs (the ticket).
The check never enters a real password, so it cannot see a failure after
Google's own page.

**First steps.** Google's sign-in is outside the app: check the
`runtime.connected-services` check of the same run first. Then
`bun obs last --errors --source prod` for `/api/auth` failures, and the
session route group in "Signing in is quick".

## people-can-host-and-join-spaces

**Measures.** The Health run's `spaces.spaces` check: people can host a
space and join it in this environment.

**Target and window:** [people-can-host-and-join-spaces](../specs/spaces/spaces-and-live-updates.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Creating or joining spaces fails for people.

**First steps.** The run's failing scenario; then "Changes are saved"
(creating a space is a save) and the sync slice of "The app serves people".

## live-updates-can-reach-everyone

**Measures.** The Health run's `spaces.live-updates` check: the app can pass
on what happens in a space to everyone in it, people's apps follow this
environment's spaces, and nobody can listen in with a well-known password.
Two players really seeing each other's moves is the multiplayer journey in
people-can-play-games-end-to-end.

**Target and window:** [live-updates-can-reach-everyone](../specs/spaces/spaces-and-live-updates.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Moves and changes do not reach other players live (they
may arrive on refresh), or do not persist.

**First steps.** "Live updates can connect" first (the broker itself), then
the `runtime.connected-services` check of the same run, then the Worker's
publishing errors in the logs. How long a move takes to reach the other
player has no measurement of its own yet (see the gaps in SLO_COVERAGE.md).

## live-updates-can-connect

**Measures.** Every ten minutes in production (hourly elsewhere) Synthetic
Monitoring asks the broker (`https://<broker host>/mqtt`) for the answer a
browser gets just before upgrading to live updates (426, "requires use of
the Websockets protocol"): DNS, TLS and the broker are up.

**Target and window:** [live-updates-can-connect](../specs/spaces/spaces-and-live-updates.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** People's apps cannot connect for live updates: nobody sees
anyone else's moves until they refresh, and maybe not then.

**First steps.** The broker is AWS IoT Core: its custom domain, certificate
and authorizer are in `libs/infra-shared-ts/tofu` (`modules/pubsub`). Check
the AWS Health dashboard for IoT Core in the region, then the custom domain's
certificate.

## people-can-play-games-end-to-end

**Measures.** Every critical journey (`specs/journeys/`) and every game's
own health check, each game a slice: the share of checked hours in which
all of them passed. A run counts bad when any game failed, and the Grafana
rules burn per game, so one broken game pages by itself.

**Target and window:** [people-can-play-games-end-to-end](../specs/journeys/game-journeys.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** At least one game cannot be found, played to the end, or
found again afterwards.

**First steps.** The dashboard's `app_synthetic_check` slice names the game.
`journeys.critical-journeys` runs only in production. The failing run keeps
its browser evidence as an artifact for production.

## the-app-serves-people

**Measures.** People's requests (route groups sync, session, room, billing,
media, app) the server answered without a 5xx. Machine traffic (health
probes, the synthetic population, telemetry uploads) is not counted. A 4xx
is a correct answer (a refusal, or a missing thing) and counts as good.

**Target and window:** [the-app-serves-people](../specs/runtime/request-success.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** People met failures.

**First steps.** The alert's `slice` (route group); `bun obs errors --since
1h --source prod`. Below 60 requests an hour the burn rates cannot judge, and
failure counts also alert: one failure pushes, three in five minutes
page.

## changes-are-saved

**Measures.** Server replays of queued writes (mutations: moves, space
changes, profile edits) that were decided (applied, duplicate or rejected by
the rules) rather than failing.

**Target and window:** [changes-are-saved](../specs/runtime/request-success.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Saves fail on the server side and are being retried.

**First steps.** `bun obs errors --source prod` for replay errors; the
database (`runtime.connected-services`).

## saves-and-loads-are-quick

**Measures.** Sync requests (`/api/query`, `/api/mutations`) answered within
0.5 s.

**Target and window:** [saves-and-loads-are-quick](../specs/runtime/request-speed.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Moves and changes feel sluggish for most people.

**First steps.** `bun obs slow --since 1h --source prod`: the slowest traces
and their SQL spans.

## saves-and-loads-never-stall

**Measures.** Sync requests answered within 1 s.

**Target and window:** [saves-and-loads-never-stall](../specs/runtime/request-speed.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Too many saves or loads exceed a second for the declared
objective.

**First steps.** As above; look for one query or one database round trip
dominating the slow traces.

## signing-in-is-quick

**Measures.** Session requests answered within 0.25 s.

**Target and window:** [signing-in-is-quick](../specs/runtime/request-speed.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Opening the app and staying signed in got slow.

**First steps.** `bun obs slow --source prod`; Google's sign-in is outside
the app (`runtime.connected-services`).

## signing-in-never-stalls

**Measures.** Session requests answered within 1 s.

**Target and window:** [signing-in-never-stalls](../specs/runtime/request-speed.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Some people wait over a second just to be signed in.

**First steps.** As above.

## the-app-never-leaves-people-waiting

**Measures.** Every request people wait on (sync, session, room, billing,
app) answered within 2.5 s.

**Target and window:** [the-app-never-leaves-people-waiting](../specs/runtime/request-speed.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** A visible share of requests hang.

**First steps.** The route-group slice, then `bun obs slow`.

## background-work-gets-done

**Measures.** Scheduled outbox drain rounds that finished (`app_outcome` =
`success`). The drain delivers notices, match steps, account erasure and
telemetry.

**Target and window:** [background-work-gets-done](../specs/runtime/background-work.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Notices arrive late and matches wait on their next step.

**First steps.** See the README's "Scheduled outbox drain keeps failing".
The historical missing-drain evidence is recorded in
[`SLO_COVERAGE.md`](SLO_COVERAGE.md); query current evidence before assessing
production.

## outside-services-answer

**Measures.** The Health run's `runtime.connected-services` (every outside
service the app relies on still lets the app use it) and
`runtime.stored-files` (an upload is kept, shown again and removed) checks,
by the hour.

**Target and window:** [outside-services-answer](../specs/runtime/outside-services.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** A dependency is failing or slow; the tier 0 objectives
will usually say what people feel.

**First steps.** The failing scenario names the service. Check that
provider's status page before changing anything here.

## people-can-pay

**Measures.** The Health run's `billing.payments` check (paying for Plus is
real only in production).

**Target and window:** [people-can-pay](../specs/billing/payments.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** People may not be able to upgrade, or not see what they
paid for.

**First steps.** The README's "Billing provider callbacks are being
refused"; the Stripe dashboard's webhook deliveries.

## the-team-can-see-what-happened

**Measures.** The Health run's `runtime.request-records`,
`runtime.declared-environment` and `profile.finding-a-person` checks.

**Target and window:** [the-team-can-see-what-happened](../specs/runtime/team-tools.openslo.yaml).
Use the declared objective and generated alert thresholds; historical baseline
measurements are not the reliability requirement.

**Breach means.** Request trails, the environment-matches-plan check or
finding a person's trouble are broken.

**First steps.** The failing scenario; `bun obs` itself is the tool under
test, so read Grafana Explore (`logs_url`) directly.
