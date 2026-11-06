# Integration findings

## Paired panel identifiers

Candidate 55148defe: all four Battleship Won matrix cases failed readiness because custom-game-board-view identified both PairedPanels and its SegmentedControl. The native assertion did not run successfully. No recent trace existed in .observability for 2026-11-06T11:47:19.044Z–11:57:19.044Z; the Playwright log is the failure source.

Literal existing example-grids fixture reproduced the duplicate (paired-panels-red.log: one failure). PairedPanels root now uses a -panels suffix; existing switch and segment IDs remain stable. All root selectors updated. The same assertion passed (paired-panels-green.log). Registered paired-panels-duplicate-view-identifier against the owning .test.tsx. Final rebuilt matrix execution is recorded separately in browser-classification.json.

Ubuntu run 42213490645 cancelled after discovering this candidate defect; fresh final-candidate authoring is required.

## Word Tiles local list

RecoverAndSubmit failed its newly authored pre-retry disabled assertion in all four matrix states and the literal wrapper. The captured page states that the game checks words when submitted; previewCandidate deliberately returns playable=true while the local list is unavailable. The existing words feature requires authoritative word validation and does not require the local preview list. Preserved submission capability, corrected the contradictory recovery copy, and replaced the incorrect disabled expectation with explicit enabled-and-authoritative-check assertions. Retained draft/committed tile/score/next turn/post-acceptance disabled assertions are unchanged. A separate named browser regression pins the copy and availability contract. No specs edited.

## Light Cycles synthetic swipe

All four SharedSwipe cases failed before axe/pixels. Automated diagnostic captured two native errors: setPointerCapture had no active pointer for the synthetic ID. Storybook synthetic touches now isolate native capture and restore both methods in finally; all original rider-heading and shared guidance assertions remain. Added a separate browser regression using trusted mouse input, asserting actual native capture and both riders' heading changes. The fixture is not claimed as trusted touchscreen evidence. .observability contained no recent activity for 2026-11-06T12:02:31.694Z–12:12:31.694Z.

## Word Tiles result selectors

The repaired story advanced to real acceptance, then found ambiguous generic text: score 10 also matched board row 10 and a Q tile; next-turn text appeared both in the record caption and the live status. Scoped score to the local player. The first scoped turn caption was phone-only, exposed by the desktop recheck; final assertions use the shared named status and the next player’s visible To move label, retaining visibility and exact score/turn expectations. The literal accepted-CAT regression remains registered.
