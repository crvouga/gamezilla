# PR run comments — ui-ux-overhaul

These are the other comments a run posts, besides the per-round comment
(`pr-round-comment.md`). Copy the block you need and replace each `{{…}}`.

---

## Opening comment

Post this once, right after you open the draft PR. The marker line comes from
`scripts/council-round init-run`. Keep it, because resuming depends on it.

```markdown
## UI and UX overhaul: run plan

This PR may redesign the experience: moving controls, reorganizing screens, rewriting labels and redoing flows, wherever that removes observed friction. Every primary journey's task must still be completable. Each round shows before and after screenshots, before and after journey sequences, and an Agent Council rating from every member below.

| Setting | Value |
| --- | --- |
| Skill | `ui-ux-overhaul` |
| Council roster | {{claude, codex, gemini}} |
| Minimum | **{{9}}/10** for both design and UX, from every member, on the same revision |
| Rubric | `assets/council-review-prompt.md` (sha256 `{{PROMPT_SHA256_SHORT}}`), fixed for this run |
| Storybook | {{URL or "static build, see Evidence"}} |
| Evidence branch | `{{overhaul-evidence/pr-N}}` (images only, never merged) |

**Primary journeys.** These are numbered for the council, which assesses each one every round.

| Id | Goal | Steps today | Observed friction |
| --- | --- | --- | --- |
| J1 | {{Invite a friend to a space}} | {{4}} | {{The invite action is two screens deep, and "Share" does not say it invites.}} |

**Screens and states under review.**

| Screen | States | Story ids | Viewports / themes |
| --- | --- | --- | --- |
| {{Space detail}} | {{host, guest, empty}} | `{{screens-spaces-detail--host}}`, … | phone 390×844, desktop 1440×900 / dark, light |

**How this run ends.** It passes only when every member above gives design **and** UX at least {{9}}/10 on the same revision, every journey's task check passes on that revision, and no member reports a lost task or capability. Scores are never averaged across members, and no member is dropped. A missing review marks the round incomplete and is retried.

{{RUN_MARKER from council-round init-run}}
```

---

## Baseline comment (round 0)

Post this before any UI change. Use `pr-round-comment.md` with these differences:

- Title it `## UI and UX overhaul: baseline (round 0)`.
- **Before** and **After** are the same baseline revision, so the ratings table has no before scores.
- Replace "What changed" with two sections:
  - **Stories upserted:** which full-screen stories were updated (ids kept) or added, and the fidelity gaps fixed against the running app.
  - **Friction log:** for each journey, the steps taken in the running app and every point of friction, each with an id (`F1`, `F2`, …) for later rounds to cite.
- Show the journey strips for the current flows, and the baseline screenshots alone: `council-round gallery --pairs $EVID/round-0/after --journeys $EVID/round-0/journeys …`.
- Under **Next**, list the round-1 changes, each tied to a finding or friction id.

---

## Blocked comment

Post this when you cannot make further progress. Then stop and tell the user.

```markdown
## UI and UX overhaul: blocked in round {{K}}

**Last scored revision:** `{{SHA}}` (round {{K-1}}, {{verdict}}). **Work in progress:** `{{SHA or "none"}}`.

**What blocks the run:** {{exact cause, e.g. "The redesigned invite flow changes behavior that `specs/spaces/invite.feature` specifies, and spec text may change only in a spec commit."}}

**What is needed to resume:** {{exact action, e.g. "Approve or write the spec change for J1, then re-invoke the skill on this PR."}}

**Resume from:** round {{K}}. Evidence commit `{{SHA}}`. The roster, minimum and rubric are unchanged.
```

---

## Final comment

Generate it with `scripts/council-round final --round-url <passing round comment URL> --screenshots-url <evidence tree URL>`. The script refuses unless that round passes. Post its output as is.
