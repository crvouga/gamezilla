# Execution requirements of shared specifications

The first draft Actions run, `40103944542`, exposed Pong being selected for
contracts that explicitly require a turn, winning move, turn clock, daily game
or named clock choice. The shared table already supports `turns` and
`clock choices`; forty-two entries now declare the requirements their text
uses. The registered games and planner are unchanged. Hybrid games offering
both still inherit both sets of obligations.

`simulation-specification-needs-red.log` reproduces five literal plans selecting
Pong for `game-turns`, winning-move results, 5+0 accessibility, daily clocks and
daily result notices. `simulation-specification-needs-green.log` passes all
nine checks, including retaining Pong's real creation, invitation, clockless
search and continuous-game obligations. The known regression is
`simulation-enrolled-in-turn-only-specifications`.

`simulation-specification-needs-quality.log` passes all three Games harness
unit, type and lint tasks. Actual old turn contracts and continuous counterparts
still need their current execution verdict. This classification does not
establish complete continuous lifecycle, access, accessibility, result,
history or rematch coverage; those requirements remain open in
`REALTIME_IMPLEMENTATION.md` under `@libs/games-shared-ts/docs/`.

The Actions logs are saved as `ci-shard-{1,8,10}.log` and
`ci-job-120903530{968,982,989}.log` under `.cache/pong/`. Other jobs never
started: their check-run annotation says an Actions budget prevents further
use. That external failure is distinct from these executable conformance
failures. No budget, retry, skip or fake Pong clock was introduced.
