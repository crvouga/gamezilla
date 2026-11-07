# Round 8 stopping point

Source `0e6f06190addaf9cf7610f9ba106d8be6d10fdc0`. Media evidence `eab9af9bebde1e36`. The user stopped redesign, further score rounds, new independent reviews and optional canonical/gallery work. No score, acceptance, reference update or PR merge is claimed.

Main was merged normally at `4faa3b594` from `1d915333c53d81fdc707888f1c087395ee3bc2cb`; the 23 conflicts and resolutions are retained in checks. GitHub reports MERGEABLE, nondraft; required safety is still pending in [run 42342271919](https://github.com/crvouga/gamezilla/actions/runs/42342271919). Parent owns the existing PR watch and final handback.

## Automated results

- Focused dependency-aware lint/type/test aggregate: **97/97**, including serialized static Storybook build, Node 8GiB, at `54ed1b515`.
- Final test-registration-only change: UI harness lint/type/test **3/3** at the final source. No application, story, fixture, style or renderer changed after the build; exact one-path difference and build hashes are in [build-provenance.json](build-provenance.json).
- Configured brand isolation: **2/2** tasks, 17,112 files; six hardcoded readiness URLs replaced with repository-relative workflow pointers. No exemption added.
- Native repaired cases: **67/67 functional checks**, comprising 65 readiness/play/browser-error/serious-critical-axe cases and two layout-only cases. All 65 pixel comparisons differ from existing references; none accepted. See [focused verdict](checks/focused-native-verdict.json).
- Initial full matrix: 824 cases at `5bfc1564a`, 750 pixel failures, 65 interaction/accessibility-stage failures and nine passes (font eight, instrumented one). Every observed functional failure was repaired and included in the focused rerun, except the two removed MapOnly registrations for the intentionally removed mode. The final whole matrix was not repeated under the stopping rule.
- Required local `bun verify`: run **once** on final source; failed at `ci:goals`, 20/30 tasks after 13/13 preparation tasks. Five inherited outside-board literal-test registrations fail: account-connect error label, denial explanation, friend long name, publication denial, and synthetic-population initial fixture. No specs or gate rules changed. The previously diagnosed troubleshooting chart-owner issue was not reached in this final run.
- Battleship consumer/spec preparation: 11/11 tasks passed after inert-overview and locked-picker repairs. Live stack attempt: 0/24, all stopped at `status-current-user` before board setup; live fleet placement/firing is not proven. No blind rerun.

## Media and source binding

[Gallery](GALLERY.md): 12 screenshots (390×844 / 1440×900, both themes) and six audited assertion recordings for spatial ship-region selection, contextual blank assignment and Numberlink Next Puzzle. All recordings finish with zero checkpoint failures. Browser-ready MP4 copies were fully decoded and hashed; original WebMs remain preserved. Automated pacing is not human timing; before/after human task counts remain unknown.

The static build was executed at `54ed1b515d1284887937e7073420b2ff0a315970`, hash `0279a32ab2c3c7f756b3eaea2ab127dc2a3333f67d7be73ce241f66ff53386db`. Final source differs only by registering the new native test file. Media uses the identical build bytes. [Manifest](manifest.json) binds each image/video. Round-seven before images remain pinned to `f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d`, source `b60694664`, evidence `46d72c8321c65c53`; new ship-region and Next Puzzle states explicitly have no prior image. The [prior full gallery and all-family recordings](https://github.com/crvouga/gamezilla/blob/f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d/round-7/GALLERY.md) are historical evidence, not final-source captures.

Numberlink saving/Next changes are **story fidelity**. Production already had actual rules, save status and Next behavior; this does not establish a persisted-navigation repair. Unrepaired Numberlink republication was not rerun. The superseded hosted Hill refused-move diagnosis remains unresolved as a root-cause claim; a later hosted pass alone did not prove its cause fixed.

## Limits and retained diagnostics

Canonical Ubuntu author/compare was not dispatched for this stopping candidate. No reference acceptance. New independent reviews and the previous unanimity target were waived by the user's stopping instruction. Full-gallery regeneration and remaining coverage exploration were stopped.

All published files are inventoried in [ARTIFACT_INDEX.md](ARTIFACT_INDEX.md). Final native artifact sets and the initial full classification/log are published. The complete initial 7,438-entry artifact set and the 40,120-member local full-gate diagnostic archive remain preserved in `.overhaul-evidence/ui-ux-overhaul/round-8/interactions/` in the source checkout. The full archive parts are intentionally not uploaded in this concise stopping bundle; their hashes and local source are retained in `checks/verify-diagnostics-parts.json`. These retained local files are not represented as public downloads.
