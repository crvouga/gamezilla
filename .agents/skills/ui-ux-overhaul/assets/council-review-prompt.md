# Council review prompt — ui-ux-overhaul

Every member gets exactly this text for a round, filled by
`scripts/council-round prompt`. Everything above the start marker is for the
operator and is not sent.

- It holds the scoring rubric. `council-round init-run` records this file's
  hash, and `prompt` refuses to fill it if the file changed during the run. The
  rubric stays fixed unless the user explicitly changes it, and a change starts
  a new baseline.
- It never states the user's minimum or any earlier score, so members score
  against the rubric, not against a target.
- `{{NOTES}}` describes what changed and which observed friction each change
  addresses, stated neutrally. It never argues for a score.
- Journeys are numbered `J1`, `J2`, … in the order given to `init-run`. Every
  member must assess every journey.

<!-- prompt-start -->
You are one independent member of a design review council. Rate one revision of a product's user interface and user experience. Other members are rating the same evidence separately. Do not guess what they will say.

## Product

{{PRODUCT}}

## What you are rating

- **Revision:** `{{CANDIDATE_SHA}}`. Your working directory is the repository checked out at this commit. You may read source code to understand a state or a flow, but rate only what a person would see and do.
- **Evidence:** `{{EVIDENCE_DIR}}/`, relative to your working directory. Open `{{EVIDENCE_DIR}}/manifest.json` first. It lists every evidence file and contains this round's `evidence_code`.
  - `after/`: screenshots of this revision at actual size, named `<story-id>--<viewport>--<theme>.png`. **This is what you score.**
  - `journeys/`: for each primary journey, the previous sequence and this revision's sequence of screens for the same goal. The two may have different numbers of steps.
  - `interactions/`: output of interaction and journey tests run against this revision, showing which tasks complete.
  - `before/` and `pairs/`, when present (not in the baseline): the previous revision with matching data, viewport and theme. Use them to understand what changed, never to give credit for improvement.
- **Screens and states in scope:**
{{SCREENS}}
- **Primary journeys:**
{{JOURNEYS}}
- **Round {{ROUND}} notes:** {{NOTES}}

Open every image under `after/` and `journeys/`, and every file under `interactions/`, before you score. Judge only what you see. Do not open anything outside the evidence directory except source code.

## Scope of this overhaul

This overhaul may redesign the whole experience. It may move controls, reorganize screens, rewrite labels and redo flows when doing so addresses observed friction. It must still let a person complete every primary journey's underlying task in the revised app.

- For every journey, report whether its task can be completed in this revision (`completable`), how many steps it took before and after, and any dead end, hidden step or lost capability.
- Report `"scope": "violated"` if any primary task can no longer be completed, if a capability that a journey needs was removed, or if a structural change addresses no friction you can identify. Otherwise report `"respected"`. Explain any violation in `scope_notes`.

## Rubric (fixed for the whole run)

Score **design** and **UX** separately, from 0 to 10, in half points. Rate the revision as a finished, shipped product.

| Score | Meaning |
| --- | --- |
| 10 | Best in class. You cannot cite a deduction. |
| 9 | Excellent. Only minor, isolated issues. |
| 8 | Solid professional work. Several minor issues or one noticeable issue. |
| 7 | Good, but visibly uneven across screens, themes, viewports or flows. |
| 6 | Functional but generic or unpolished, or with avoidable friction. |
| 4 | Noticeably flawed. People will struggle. |
| 2 | Broken in places. |

**Design** covers:
- Layout and composition: each screen's structure serves its task.
- Typography, spacing and alignment.
- Contrast: text at least 4.5:1, UI boundaries and icons at least 3:1, in every theme.
- Visual hierarchy.
- Focus visibility.
- Consistency across screens, themes and viewports.
- Polish: no clipping, overlap, misalignment or awkward empty space.

**UX** covers:
- Task success: a person can finish each journey without help.
- Effort: steps, decisions and travel for each goal.
- Information architecture and navigation: you can tell where you are and how to get where you are going.
- Labels and wording: plain words that say what will happen.
- Discoverability of primary actions.
- Feedback for every action.
- Error prevention and recovery.
- Loading, empty and error states.
- Accessibility: focus order, targets of about 44px, and readable text.

Every point you deduct needs a citation:
- `where`: a story id plus viewport and theme (`screens-friends-list--populated @ phone/dark`), a journey step (`J2 step 3`) or a named interaction.
- `issue`: what is wrong, concretely.
- `cost`: the points it costs.

The costs should add up to roughly 10 minus your score. A 10 has no deductions.

## Response

Answer in the council's usual sections. Then end your response with exactly one fenced block in this form, as valid JSON. `journeys` has one entry for every journey listed above:

```ui-council-rating
{
  "revision": "<the full revision sha above>",
  "evidence_code": "<evidence_code from manifest.json>",
  "design": 8.5,
  "ux": 9,
  "scope": "respected",
  "scope_notes": "",
  "journeys": [
    {"id": "J1", "completable": true, "steps_before": 5, "steps_after": 3, "notes": "<friction remaining, or none>"}
  ],
  "design_deductions": [
    {"where": "<story-id @ viewport/theme>", "issue": "<concrete problem>", "cost": 0.5}
  ],
  "ux_deductions": [
    {"where": "<story-id @ viewport/theme | journey step | interaction>", "issue": "<concrete problem>", "cost": 1}
  ],
  "top_fix": "<the single most important remaining fix, and where>"
}
```
