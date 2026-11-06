# Ubuntu reference review

Run [42219355180](https://github.com/crvouga/gamezilla/actions/runs/42219355180) used source `69d07c220beb5c0d1d985e0e142b66a52a7843e8`, the requested full board/shared-primitive pattern, explicit Ubuntu authoring and a second comparison. Authoring passed 610/610. Comparison passed 608/610; the two failures reached pixels after readiness/play, browser-error and serious/critical axe checks.

The complete public job log decoded to a 62 MB binary patch containing 590 changed references under both libs and pkgs. Every patch path was validated, staged separately, hashed and inspected in the 59 indexed contact sheets. This is review of automated reference artifacts, not manual product QA or a UX score. Ten selected references were unchanged and therefore absent from the patch.

587 references were selected and copied byte-for-byte from the Ubuntu output. They show the intended board palette, boundaries, orientation/guidance, action wrapping, readable Hearts seats, recovery/completion states, expanded placement controls and shared-frame states. The matching comparison cases passed. Automated story assertions remain the behavior evidence. Full PNGs remain under `staged/` locally; contact sheets and the compressed complete patch preserve the public review evidence.

Three references are deliberately withheld, listed with hashes in `withheld.json`:

- Match `recover-and-submit`, dark 1440: 8,403 pixels differed in the new comparison.
- Puzzle `enlarged-blank`, light 1440: the public log masks a digit in `***2353` differing pixels and reports ratio 0.02. No exact count is inferred.
- Match `recall-and-restore`, light 1440: passed this comparison, but run 42207319704 previously differed by 43,547 pixels. A later pass does not explain that finding.

Word Tiles post-action images can show the viewport after an automated action scrolls controls into view. This observation does not establish the cause of the failed comparisons. No threshold, assertion, gate, spec or product behavior was changed to hide variance, and no macOS baseline was accepted.

The documented CI-bucket download was attempted for the new run and failed: Infisical unavailable, no local cache, and CI_ARTIFACTS_BUCKET unset. CI uploaded ten files, including failed comparison diagnostics, but their actual/diff PNGs are not locally accessible. The exported patch contains the authoring references, not those failed actual images. Next action is to retrieve that exact expected/actual/diff evidence, identify the changed regions, pin any confirmed defect and repair its cause before accepting the three withheld references.

`accepted.json`, `withheld.json`, `patch-inventory.json`, `contact-sheet-index.json` and `verdict.json` record the selection. Source commit `3ec6d124e0ad5487a06f0a3334aa09be0c7ce5dc` contains only the 587 selected PNGs and six readiness-note updates. Product/story/test source is unchanged from the run.
