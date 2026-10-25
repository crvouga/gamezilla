# Pong completion and rematch journey

Verdict: **PASS for the simulated completion/rematch journey**.
Scope: `specs/journeys/pong-game.feature` and its published-language edges.
The strict spec and ownership gates pass. The whole runtime/journey context
passes 126 checks, and the Pong context passes 61. Live-browser execution and
the full release verdict remain unproven.

## Contract review

Context: Journeys. The people find each other, play Pong to its target,
see Alice's victory, offer and accept a rematch, and see swapped paddles,
zero scores and the same target. The story follows those observable outcomes.
No product rule, term or meaning is invented. Rematch policy is Games' existing
rule; scoring and victory are Pong's existing rules.

| Verification | Evidence |
| --- | --- |
| A0–A2, A5–A6, D1 | Every line concerns Alice and Bob playing, winning and playing again. There is no technical vocabulary, implementation identifier, copy assertion or avoided synonym. |
| A3–A4 | Existing Pong, paddle, score and target-score terms and the Games rematch are published and borrowed. Qualified `wins Pong` / `won Pong` forms belong to the already published Pong term; unqualified victory verbs remain local to Pong. The context map names both edges. |
| B1–B3, B10 | Capability title, one situation/motivation/outcome story, one rule and a unique action title. |
| B4–B5, C1–C6 | The standard explicitly exempts critical journeys from isolated counter-examples, one-event shape and aggregate coverage maps. Scoring/shared guidance and Games rematch policies retain their own models and refusal examples. |
| B6–B9 | No procedural Given. Three Whens follow playing to completion, offering and accepting. Playing from fresh devices follows the existing Connect Four/Battleship journey shape; no compound offer/accept step is used. All Thens are visible outcomes. |
| B11–B13 | No Background or outline; people are in the cast and scores are the real zero boundary of a new game. |
| B14–B15 | Play-from-fresh-devices follows existing game-journey wording; offer and accept reuse Games' exact wording. Only `@domain:journeys` is used. New Pong observations have no existing journey equivalent. |
| B16 | Six steps: warning, below the eight-step limit. Each outcome distinguishes finished play from a reset rematch; splitting would lose the handover being verified. |
| B17 | The people see the winner, assigned paddles, scores and target. Identity/generation fencing remains a code contract, not prose here. |
| P1–P2 | Contract changes and this audit are a separate spec-only commit. Implementation treats them as read-only. |

## Implementation evidence

`pong-journey-author-gate-final.log` under `.cache/pong/` is the authoring
gate; it reported only the undefined handoff steps. Those steps are now bound
on the existing `JourneyHost`, using real finding, paddle controls and rematch
actions. Alice's natural target-score victory is observed before the rematch;
no fixture result or resignation establishes it. The first assignment and
target are retained to compare the new game. No transport, session, game
registration or automated human account was added.

The step definitions only call public harness helpers. UI reads and gestures
live in those helpers; the existing court reader now accepts the actual board
identifier. Explicit host elapsed time uses virtual time in the harness and
the existing injected wall timer in the live adapter (D2–D6).

Evidence under `.cache/pong/`:

- `pong-journey-undefined-red.log`: the new journey fails undefined.
- `pong-journey-bound-second.log`: the whole journey passes by itself.
- `runtime-after-pong-journey.log`: all 126 runtime/journey checks pass,
  including existing chess, custom-game, Connect Four and Battleship journeys.
- `pong-after-journey-reader.log`: all 61 Pong checks pass with the shared reader.
- `pong-journey-quality.log`: all six affected unit/type/lint tasks pass.
- `pong-journey-type-lint.log`: all six type/lint tasks, including the live
  product adapter, pass.
- `pong-journey-bound-policy-current.log`: strict spec and ownership gates pass.

Technical timing, stale room identities, input generations and bounded waiting
belong in code contracts. The full current gate, automated production-like
rehearsals, broader recovery and readiness remain separate outstanding work.
