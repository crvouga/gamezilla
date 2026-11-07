# Initial full native diagnosis

Source `5bfc1564a2f509fb81ea1c0d6d32684b245d4520`: 824 cases, 65 interaction/accessibility-stage failures, 750 pixel failures, nine passes (font eight and instrumented one). No reference acceptance. Complete logs and artifacts remain under `full-native-initial/`.

- Quoridor goals inherit a solid border style from reset. Explicit borderless corner markers preserve flat cell boundaries and physical wall edges.
- Four-player assertions still demand a single row. Round-eight product intentionally has two columns; replacement assertions require two rows, full names/facts, disjoint columns, 44px seat height and the original board bounds.
- At 390×844, the drawn frame board starts at y445 versus the existing y440 bound. Outcome padding is reduced by one token step; the bound remains unchanged. Upstream final-record wording is Finished.
- FourPlayerRound e5h wall commit sits at y823.75..867.75. The four-coordinate turn wraps to 76px and compounded layout gaps consume vertical room. Reduce those gaps while retaining coordinates, all identities, board cell size and control targets.
- Word Tiles desktop near-seat y781.984375..839.984375 is inside the browser viewport but clipped by the host content region. Fitted board sizing must account for the host; the enlarged viewport remains at least 308px.
- Fitted puzzle a1 corner (526.265625,426.265625) hits the board rather than the cell. Rounded corners consume this small fitted target; square cell boundaries retain its actual rectangle without relaxing corner assertions.
- Removed MapOnly Battleship mode still had desktop registrations. Remove obsolete registrations, retaining the current Precise region navigation and immutable older media.
- Word Tiles commands are in the board workbench, with secondary tools behind its disclosure; the integration selector still targeted the record sidebar.
- Sokoban solved status is Completion saved; preserve its production semantics and update the stale story expectation.

Configured hosted brand-policy separately found six readiness PR URLs containing deployment identity. Replace these with repository-relative evidence-workflow links and retain PR 280 in prose. Configured gate passed 2/2 tasks; no exemption added. All seven safety shards passed on this checkpoint, but verify:end failed; the hosted gate is not green.

Repairs remain subject to focused checks, rebuilt static Storybook and a full final native matrix. Geometry probes are diagnostics, not replacements for that gate.
