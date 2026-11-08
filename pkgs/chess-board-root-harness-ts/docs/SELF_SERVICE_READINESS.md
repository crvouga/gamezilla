# Chess board readiness

The shared [readiness definition](../../../../docs/SELF_SERVICE_READINESS.md)
remains authoritative. This game-owned record supplies the chess update while the
central matrix is reserved by the concurrent overhaul coordinator.

| Task | Failure and recovery | Automated evidence | Limits |
| --- | --- | --- | --- |
| Choose a square using assistive activation | Click-only activation enters the same selection and legal-move logic; pointer-generated clicks cannot toggle the completed press again | `assistive-activation.test.tsx`: literal e2/e4 regression and generated opening-pawn/orientation cases | DOM contracts; device screen-reader speech is not measured |
| Explore a read-only board | Squares remain focusable and named while reporting activation as unavailable; attempted moves change nothing | `assistive-activation.test.tsx`: disabled square semantics regression | Transport/reconnection behavior remains owned by consumer harnesses |
| Decide or cancel promotion | A named dialog confines Tab to the piece choices and Cancel; Escape cancels without a move and restores the source square | `assistive-activation.test.tsx`: promotion focus boundary regression; existing promotion models | Fresh hosted browser captures pending |
| Retry a wrong puzzle move on a tablet | Guidance keeps its footprint while unavailable controls become hidden and inert, preserving the centered board's position | `guidance-recovery.test.tsx`; named 768px Storybook recovery regression | Hosted geometry confirmation pending |

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
candidate failures were the 768px puzzle recovery rectangle assertion, which
motivated the guidance-footprint fix. Videos and images were retained by hosted
CI but local artifact access is unresolved; no visual-review score is inferred.
