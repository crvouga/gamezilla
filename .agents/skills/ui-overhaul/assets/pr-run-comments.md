# PR run comments — ui-overhaul

These are the other comments a run posts, besides the per-round comment
(`pr-round-comment.md`). Copy the block you need and replace each `{{…}}`.

---

## Opening comment

Post this once, right after you open the draft PR. The marker line comes from
`scripts/council-round init-run`. Keep it, because resuming depends on it.

```markdown
## UI quality overhaul: run plan

This PR polishes the existing UI. Navigation, screen composition, control placement, labels and task steps stay the same. Each round shows before and after screenshots, and an Agent Council rating from every member below.

| Setting | Value |
| --- | --- |
| Skill | `ui-overhaul` |
| Council roster | {{claude, codex, gemini}} |
| Minimum | **{{9}}/10** for both design and UX, from every member, on the same revision |
| Rubric | `assets/council-review-prompt.md` (sha256 `{{PROMPT_SHA256_SHORT}}`), fixed for this run |
| Storybook | {{URL or "static build, see Evidence"}} |
| Evidence branch | `{{overhaul-evidence/pr-N}}` (images only, never merged) |

**Scope.** Typography, spacing, alignment, contrast, hierarchy, focus visibility and consistency.

**Primary journeys.**
1. {{J1}}
2. {{J2}}

**Screens and states under review.**

| Screen | States | Story ids | Viewports / themes |
| --- | --- | --- | --- |
| {{Friends list}} | {{populated, empty, loading, error}} | `{{screens-friends-list--populated}}`, … | phone 390×844, desktop 1440×900 / dark, light |

**How this run ends.** It passes only when every member above gives design **and** UX at least {{9}}/10 on the same revision, the checks pass, and the scope above is respected. Scores are never averaged across members, and no member is dropped. A missing review marks the round incomplete and is retried.

{{RUN_MARKER from council-round init-run}}
```

---

## Baseline comment (round 0)

Post this before any UI change. Use `pr-round-comment.md` with these differences:

- Title it `## UI quality overhaul: baseline (round 0)`.
- **Before** and **After** are the same baseline revision, so the ratings table has no before scores.
- Replace "What changed" with **Stories upserted**: which full-screen stories were updated (ids kept) or added, and the fidelity gaps fixed against the running app.
- Replace the paired gallery with the baseline screenshots alone:
  `council-round gallery --pairs $EVID/round-0/after …`.
- Under **Next**, list the round-1 fixes, chosen from the members' findings.

---

## Blocked comment

Post this when you cannot make further progress. Then stop and tell the user.

```markdown
## UI quality overhaul: blocked in round {{K}}

**Last scored revision:** `{{SHA}}` (round {{K-1}}, {{verdict}}). **Work in progress:** `{{SHA or "none"}}`.

**What blocks the run:** {{exact cause, e.g. "gemini is on the roster but its CLI returns `auth` errors in three council attempts (sessions …)."}}

**What is needed to resume:** {{exact action, e.g. "Run `gemini` once and sign in, then re-invoke the skill on this PR."}}

**Resume from:** round {{K}}. Evidence commit `{{SHA}}`. The roster, minimum and rubric are unchanged.
```

When a member's findings can only be fixed by changing navigation, layout, controls, labels or steps, that is outside this skill's scope. Record it here as a blocker and suggest running `ui-ux-overhaul`. Do not change the structure yourself.

---

## Final comment

Generate it with `scripts/council-round final --round-url <passing round comment URL> --screenshots-url <evidence tree URL>`. The script refuses unless that round passes. Post its output as is.
