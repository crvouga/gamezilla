# Word Tiles board review

This run covers the registered two-, three- and four-player games. Product
contracts remain in [the Word Tiles specs](../../../specs/word-tiles/).
Implementation and evidence follow the [Storybook agent workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow).

## Evidence matrix

| Task or state | Existing production story / verification | Required extension |
| --- | --- | --- |
| Place, preview and submit a word | `screens-games-word-tiles-board--place-a-word`, `--recover-and-submit` | Record touch and keyboard journeys for all three seat counts. |
| Move or retract a tentative tile | `--recall-and-restore`; board DOM contracts | Record individual movement/retraction, recall, undo and redo. |
| Assign a blank | `--assign-a-blank` | Record accessible chooser, cancellation and continued placement. |
| Navigate a large board | `--enlarged-coordinates`; precision and map contracts | Record zoom, pan, region selection and keyboard edge navigation. |
| Pass or exchange | `--accepted-pass`, `--accepted-exchange` | Retain authoritative settlement and clear turn feedback. |
| Observe a game | `--watching`, `--three-players`, `--four-players` | Check every score, active seat and rack privacy in both themes. |
| Recover or finish | `--checking-words`, `--word-list-unavailable`, `--unreadable`, `--game-over` | Preserve drafts and show an actionable next step. |

Capture phone (390 × 844), narrow phone (320 × 740), tablet (768 × 1024),
and desktop (1440 × 900), light and dark. Use fixed fixtures and identical
interaction sequences before and after. Capture browser input/render timing
and long tasks, including a documented CPU-throttled mobile run; emulation
is evidence about those conditions, not a physical-device performance claim.

## Independent review contract

Each round has two fresh independent Codex reviewers, `reviewer-a` and
`reviewer-b`, separate from the implementer. Both receive the same immutable
revision, hashed evidence index, task results and fixed rubric. They inspect
actual images and interaction recordings/traces independently. They score
functional design clarity, UX/playability, and performance/responsiveness
separately. Missing evidence is incomplete, never a perfect score.

Completion requires all three dimensions to receive 10/10 from both reviewers
on the same revision, all required automated checks to pass, and every
underlying task to remain completable. Round comments on the dedicated PR
preserve findings, deductions, before/after SHAs, uploaded screenshots and
videos, performance conditions, verification results and next fixes. No manual
testing and no merge by the agent.
