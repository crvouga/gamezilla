# PR comment templates: ui-overhaul

Copy a block, fill every `<…>`, and post it with the host's comment command (see `hosts.md`).
Image references are relative paths (`./before/home--phone-light.png`), so the host's attach
step can upload them and rewrite each reference to an upload that later pushes cannot change.
Each comment ends with a hidden machine-readable block. Another agent resumes the run from these
blocks, so never edit or delete a posted round comment. Post a correction as a new comment.

---

## 1. Opening comment (once per run)

````markdown
<!-- ui-overhaul:run -->

## UI quality overhaul: run record

**Skill:** ui-overhaul: polish the existing UI with minimal disruption. Navigation, screen
composition, control placement, labels and task steps stay as they are.
**Council:** <claude, codex, gemini> (Agent Council, <pinned revision>)
**Minimum:** every member gives design **and** UX at least **<9>/10** on the same revision.
**Rubric:** `council-review-prompt.md`, sha256 `<rubricSha256>` (fixed for the run).

### Scope

<what's in, what's out>

### Primary journeys

1. <journey: user goal, start screen → end state>

### Screens and states under review

| Screen     | States                   | Storybook story IDs           | Viewports           | Themes        |
| ---------- | ------------------------ | ----------------------------- | ------------------- | ------------- |
| <Settings> | <default, saving, error> | `<screens-settings--default>` | <390×844, 1440×900> | <light, dark> |

<details><summary>run.json</summary>

```json
<contents of .ui-overhaul/run.json>
```

</details>
````

---

## 2. Round comment (baseline is round 0; post one per round, including failed and incomplete rounds)

````markdown
<!-- ui-overhaul:round <n> <PASS|ANOTHER_ROUND|INCOMPLETE> -->

## Round <n>: <PASS ✅ | another round needed | INCOMPLETE: review missing>

**Before:** `<startSha>` (evidence `<beforeEvidenceId>`) → **After:** `<candidateSha>` (evidence `<evidenceId>`)
**Council session:** `<council session id>` · **Minimum:** <9>/10, design and UX, every member

### What changed

- <screen/state>: <change> (addresses <member>'s finding: "<quote>")

### Before / After

<one table per screen or journey; same data, viewport and theme in each pair>

**<Settings / error state>** · <390×844> · <dark> · story `<screens-settings--error>`

| Before (`<startSha7>`)                                              | After (`<candidateSha7>`)                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Settings error, before](./before/settings--error--phone-dark.png) | ![Settings error, after](./after/settings--error--phone-dark.png) |

Interaction evidence: <journey logs / recordings, with step counts>

### Ratings

<paste `council-round.mjs verdict --format markdown` output unchanged>

### Findings by member

<details><summary><member>: design <x>, UX <y>. Top fix: <…></summary>

<the member's deductions, quoted from its opinion file, each naming a screen or journey step>
</details>

### Checks on `<candidateSha>`

| Check        | Result                                                 | Link        |
| ------------ | ------------------------------------------------------ | ----------- |
| <type-check> | <pass>                                                 | <url>       |
| Scope audit  | <pass: no route, label, control order or step changes> | <diff link> |

### Verdict

<PASS: every member meets the minimum on this revision. | ANOTHER_ROUND: <who is below and on what>. | INCOMPLETE: <who is missing and why>. Retrying on the same revision.>

### Next fixes

1. <highest-impact fix, screen/state, source finding>

<details><summary>round.json</summary>

```json
<contents of .ui-overhaul/rounds/<n>/round.json, plus each member's design/UX after scores under "scores">
```

</details>
````

---

## 3. Blocked comment (when no further progress is possible)

```markdown
<!-- ui-overhaul:blocked <n> -->

## Round <n>: blocked

**Last scored revision:** `<sha>` (round <m>, <verdict>)
**Blocker:** <exactly what failed, with the command and its error>
**To resume:** <the exact thing a human must provide or fix>, then rerun the skill. It picks up
from this comment.
```

---

## 4. Final comment (only after a PASS round)

```markdown
<!-- ui-overhaul:final <n> -->

## UI quality overhaul passed in round <n>

Every council member (<claude, codex, gemini>) gave design and UX at least <9>/10 on
`<candidateSha>`, its checks pass, and the scope audit passed.

- Passing round: <link to the round <n> comment>
- Screenshots: <link to that comment's Before / After section>
- Baseline: <link to round 0>

| Member   | Design before (round 0) | Design after | UX before (round 0) | UX after |
| -------- | ----------------------- | ------------ | ------------------- | -------- |
| <claude> | <7>                     | <9.5>        | <7.5>               | <9>      |
```
