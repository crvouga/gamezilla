# Connect Four overhaul task completion

The product promises live in [Connect Four specs](../../specs/connect-four/) and
[the two-person journey](../../specs/journeys/connect-four-game.feature). This is
an evidence map, not another product definition.

| Existing task | Production verification path | Board evidence and limits |
| --- | --- | --- |
| Find another person and finish the same game on both devices | The journey binds through `@libs/runtime-harness-ts/game-journey.steps`, `playGameJourney` and `observeGameJourney`; `CONNECT_FOUR_PLAYABLE` supplies seven alternating column choices. The release runner builds the production bundle with test hooks off and drives the live stack. | Hosted Verify PR run 42436544028 at `0d7b32f2b7e31d300625cc25ca685ee86f7e0dac` completed all three release-journey partitions with cache misses and exit zero. Successful logs report partition completion, not individual scenario names. |
| Place a disc, preserve existing discs, and identify the next side | [Game rules](../../specs/connect-four/play-connect-four.feature) and the registered game harness; the production journey uses the registered board action. | Both original focused runs `42434969251` and `42434970941` record native click, touch and Space input, assert exactly one changed cell and preserve every occupied cell. These Storybook fixtures use real rules and presentation but do not exercise network acknowledgement. |
| Recover from an unavailable column | The full-column scenario in the Connect Four rules and the `FullColumn` production story. | Paired native Enter refusal preserves the position; the story uses keyboard navigation and a legal alternate column. Full keyboard entry/exit and native traversal evidence is being expanded for the next candidate. |
| Read a finished game or watch without making a move | The registered game presentation, finished-state stories and spectator guard. | Both runs contain win/loss/draw/waiting/spectator images at four widths in both themes, zero reported axe violations, and inert native spectator touch. Native keyboard guards for all inactive states are being expanded. |
| Retain a focused destination while alternating input methods | Framework input contracts and the production board's mixed-input capture. | Eight matched before/after cases record the fixed preview after pointer exit and after keyboard activation under hover. Literal regressions and generated focus/hover/cancel cases are in `disc-drop-focus-preview.test.tsx`. |

Round 1 (PR #290, comment 6718775531)
contains durable, byte-verified screenshot/video pairs and both independent
reviews. The captured candidate is `b6a46272509dd2bc58d2d896dc70fd5ca9f4fe27`;
the later verified head adds only the separate Numberlink helper fix.

The two reviewers rated the candidate design 9, playability 9 and responsiveness
8. Completion is still **incomplete**. These records do not prove screen-reader
speech, real-device latency, normal-motion smoothness, native builds, or all
network recovery states. Shared game-session connection and write-rejection
recovery remains owned by that surface; this board change adds no network write
or retry mechanism. Do not infer a recovery pass from a static Storybook image.
