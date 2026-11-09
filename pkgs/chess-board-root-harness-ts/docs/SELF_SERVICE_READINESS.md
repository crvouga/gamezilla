# Chess board readiness

The shared [readiness definition](../../../../docs/SELF_SERVICE_READINESS.md)
remains authoritative. This game-owned record supplies the chess update while the
central matrix is reserved by the concurrent overhaul coordinator.

| Task | Failure and recovery | Automated evidence | Limits |
| --- | --- | --- | --- |
| Choose a square using assistive activation | Click-only activation enters the same selection and legal-move logic; pointer-generated clicks cannot toggle the completed press again | `assistive-activation.test.tsx`: literal e2/e4 regression and generated opening-pawn/orientation cases | DOM contracts; device screen-reader speech is not measured |
| Explore a read-only board | Squares remain focusable and named while reporting activation as unavailable; attempted moves change nothing | `assistive-activation.test.tsx`: disabled square semantics regression | Transport/reconnection behavior remains owned by consumer harnesses |
| Decide or cancel promotion | A named dialog confines Tab to the piece choices and Cancel; Escape cancels without a move and restores the source square | `assistive-activation.test.tsx`: promotion focus boundary regression; existing promotion models; hosted run 42437334985 | Captured white-side chooser; other promotion edges remain to be captured |
| Retry a wrong puzzle move on a tablet | Guidance keeps its footprint while unavailable controls become hidden and inert; geometry distinguishes scrolling to Retry from actual layout movement | `guidance-recovery.test.tsx`; `puzzle-rectangle.test.ts`; named 768px Storybook recovery regression passed in run 42437334985 | Controls below the initial viewport remain a review finding |
| Read promotion cancellation and legal destinations | Cancellation uses the design system's contrasting foreground; dots and capture rings use its stronger icon ink | `board-affordance-contrast.test.ts`: literal Cancel and composited target-contrast regressions, including both app themes and cancellation palette overrides | Fresh hosted captures of the contrast change pending |

These changes repair DOM event routing and accessibility adapters for existing
selection, legality and promotion contracts. They add no new product rule or
specification vocabulary. The existing Chessboard specs remain unchanged.

Scoped board verification after the fixes: 56 tests pass, zero fail, and the
package typecheck passes. Full verification, current screenshot/video evidence,
accessibility scans and independent candidate ratings remain required; this
record does not claim completion of the overhaul.

The first fresh hosted comparison passed 58/72 cases on the original board and
70/72 on the assistive-input candidate. All twelve click-only/promotion-focus
failures across three widths and both themes were resolved. Both remaining
candidate failures were the 768px puzzle recovery rectangle assertion. A later
diagnostic showed the board retained its 584px width and height while Retry
scrolled its viewport top from 121 to 84 with an ancestor scroll delta of 37.
The geometry helper now measures scroll-independent layout coordinates and its
regressions still detect real movement and resizing; the one-pixel assertion is
unchanged. Videos and images were retained by hosted
CI; local access was unresolved at that stage, so no visual-review score was inferred.

Hosted run 42437334985 subsequently passed all 73 selected cases in both
capture and comparison on `8d384859`. Its delivered media and the original
baseline were independently hash-verified and reviewed by two Codex reviewers.
Both left whole-scope design, UX and performance INCOMPLETE: timed games,
puzzle review, recovery states and repeated performance measurements remain
uncovered. Their observed contrast and viewport-height findings are being
addressed. The required hosted checks passed; the focused diagnostic is not a
complete local verification or a native build.
