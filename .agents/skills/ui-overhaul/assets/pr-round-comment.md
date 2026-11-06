# PR round comment — ui-overhaul

Post one comment per round, including incomplete and failed rounds. Copy
everything below the line and replace each `{{…}}`.

Two blocks are generated, so they match the evidence exactly:

- `{{GALLERY}}`: `scripts/council-round gallery --pairs $EVID/round-<k>/pairs --base-url <commit-pinned evidence URL> --prefix round-<k>/pairs`
- `{{RESULTS}}`: `scripts/council-round render --run run.json --round round.json --ratings ratings.json --before-ratings <previous round's ratings.json> --evidence-commit <sha>`.
  This block holds the stories reviewed, the ratings table, each member's findings, the checks, the verdict and the resume marker.

For `{{NEXT}}`, write one of the following:
- **ANOTHER ROUND:** the fixes for round {{K+1}}, highest impact first, each tied to the member finding and story it addresses.
- **INCOMPLETE:** the missing member, why their review is missing, and the retry being made on this same revision and evidence.
- **PASS:** "None. See the final comment."

Do not hand-edit the scores, the table or the marker. If GitHub rejects the comment for length (65,536 characters), post the gallery as a second comment titled `Round {{K}} screenshots (2/2)` and link it.

---

## {{PR_TITLE}}: round {{K}}

**Before** `{{START_SHA}}` → **After** `{{CANDIDATE_SHA}}` · Agent Council session(s) `{{SESSION_IDS}}` · Evidence [`{{EVIDENCE_COMMIT_SHORT}}`]({{EVIDENCE_TREE_URL}})

### What changed

Polish only. Navigation, screen composition, control placement, labels and task steps are unchanged.

- {{CHANGE}}. Addresses {{MEMBER}}'s finding on `{{STORY_ID @ VIEWPORT/THEME}}`.
- {{CHANGE}}. Addresses {{MEMBER}}'s finding on `{{STORY_ID @ VIEWPORT/THEME}}`.

### Before / After

Both sides use matching fixtures, viewport and theme. Left is `{{START_SHA_SHORT}}`, right is `{{CANDIDATE_SHA_SHORT}}`. Images are pinned to evidence commit `{{EVIDENCE_COMMIT_SHORT}}`, so later pushes cannot change them.

{{GALLERY}}

### Interaction evidence

- {{INTERACTION_OR_FOCUS_EVIDENCE}}: for example, `screens-settings-index--keyboard-focus` play test passes and the focus ring is visible in `after/…--desktop--dark.png`.

{{RESULTS}}

### Next

{{NEXT}}
