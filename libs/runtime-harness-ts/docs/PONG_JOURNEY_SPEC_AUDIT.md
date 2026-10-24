# Pong completion and rematch journey

Verdict: **INCOMPLETE — authoring passes; bindings are handed off**.
Scope: `specs/journeys/pong-game.feature` and its published-language edges.
The strict gate reports only the new undefined steps; no execution is claimed.

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

## Handoff

`pong-journey-author-gate-final.log` under `.cache/pong/` is the authoring
gate. Bind the journey on the existing `JourneyHost`, using real finding,
paddle controls and rematch actions. A natural target-score victory must be
observed before a rematch; neither fixture results nor resignation establish
that step. Preserve the first assignment and target to compare the new game.
No new transport, session, game identity or automated human account is needed.

Technical timing, stale room identities, input generations and bounded waiting
belong in code contracts. The full current gate, automated production-like
rehearsals, broader recovery and readiness remain separate outstanding work.
