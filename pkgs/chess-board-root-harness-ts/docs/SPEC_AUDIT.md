# Spec audit — ChessBoard and consumer sounds — 2026-10-02
Verdict: PASS for feature/model/binding audit (0 author blockers, complete coverage, all final bound/model/spec gates green). Full mission native closure and repository Verify remain parent-owned release obligations.

Independent read-only final author audit of14 ChessBoard features/seven models/glossary plus Chess puzzle-sound feature/model and published Runtime sounds/control lenders. The final author freeze is1e1f01ac5; previous freezes479f632eb/90db3ffc9 remain incorporated. No product/spec/test file was changed by this auditor; only /tmp reports/scripts. No manual QA or board test process was run.

## Gate and evidence

Conflict-marker read scan found none. Current independent scratch shape audit:15 features, 251 declared scenarios/outlines, 58 Rules, eight models, exactly one When/max7; all current B4 closed-marker/refusal-or-truthful-exemption checks pass. Model maps below contain zero MISSING rows. Final binding sourcef7e1a8cf9. Fresh strict spec registry is GREEN13packages/1035scenarios/33models/1457steps/zero wording warnings; ownership and regenerated catalog are green (/tmp/chess-board-final-finite-{spec-check,ownership,catalog}.log). Optional capture fact canonicalization retains actual earlier slot and its final22/0 narrow verification is green (/tmp/chess-board-final-finite-capture-fact-green.log). No stale gate is presented as final.

Final1e1f01ac5 board context green1022/0,1135 assertions (/tmp/chess-board-final-finite-context.log); all seven final actual model bindings100×30 green and formal lifecycle complete418 states/depth7/all8 safety+liveAnimationFinishes (/tmp/chess-board-final-finite-model-checks.log); independent canonical API/rules contracts185/0 including96 promotion vectors and actual lastMove (/tmp/chess-board-last-move-contract-green.log); root mechanical exact parity14/0 including75ms knight refusal and identifier (/tmp/chess-board-mechanical-parity-final.log); pair119/0 root evidence. Consumer sound closure43/0,258code/3formal and227sourcegate/3soundmutants also independently read; /tmp/chess-board-consumer-conformance-audit.md is scopePASS. This audit PASS is not a full mission or release verdict.

## Per feature

### specs/chess-board/board-accessibility.feature — 0 blocking, 3 warnings

B11 warn specs/chess-board/board-accessibility.feature:6 — "Alice has an interactive chessboard" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
B11 warn specs/chess-board/board-accessibility.feature:22 — "Alice has an interactive chessboard" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
B11 warn specs/chess-board/board-accessibility.feature:146 — "Alice has an interactive chessboard" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
### specs/chess-board/board-annotations.feature — 0 blocking, 7 warnings

B16 warn specs/chess-board/board-annotations.feature:38 — "Activity square marks stay on their assigned squares" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:54 — "Choosing a piece clears completed personal marks after drawing is disabled" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:64 — "Keyboard selection clears completed personal marks after drawing is disabled" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:81 — "Choosing an empty square clears personal marks and keeps activity marks" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:97 — "A completed personal arrow offers only arrows to the activity" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:119 — "Marking a square adds a personal circle" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-annotations.feature:183 — "Replacing the position abandons only the unfinished drawing" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-authority.feature — 0 blocking, 4 warnings

B16 warn specs/chess-board/board-authority.feature:66 — "An unrelated position clears the old move and selection" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-authority.feature:133 — "Confirmation preserves the offered move without offering it twice" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-authority.feature:141 — "Refusal restores the earlier position without sound" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B11 warn specs/chess-board/board-authority.feature:131 — "Alice has a chessboard after offering White's move from e2 to e4" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
### specs/chess-board/board-black-promotion.feature — 0 blocking, 6 warnings

B16 warn specs/chess-board/board-black-promotion.feature:11 — "A Black quiet move or capture waits for choice in either orientation" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-black-promotion.feature:26 — "Disabled Black promotion cannot offer a choice" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-black-promotion.feature:37 — "Every Black quiet choice completes on a White-facing board" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-black-promotion.feature:52 — "Every Black quiet choice completes on a Black-facing board" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-black-promotion.feature:70 — "Every Black capture choice completes on a White-facing board" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-black-promotion.feature:85 — "Every Black capture choice completes on a Black-facing board" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-feedback.feature — 0 blocking, 2 warnings

B11 warn specs/chess-board/board-feedback.feature:6 — "Alice has an interactive chessboard" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
B11 warn specs/chess-board/board-feedback.feature:27 — "Alice has an interactive chessboard" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
### specs/chess-board/board-independence.feature — 0 blocking, 5 warnings

B16 warn specs/chess-board/board-independence.feature:9 — "Moving on the first board preserves the second board's selection" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-independence.feature:24 — "Holding on the first board keeps the second board's selected piece at source" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-independence.feature:40 — "Replacing one activity's position preserves the other activity's board" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-independence.feature:64 — "A disabled first board cannot offer a move or disturb the second board" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-independence.feature:103 — "Closing the first board keeps the second board selected and available" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-interaction.feature — 0 blocking, 13 warnings

B16 warn specs/chess-board/board-interaction.feature:69 — "A selected pawn completes one move and clears its selection" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:78 — "Dragging a pawn completes the same move as selection" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:87 — "Black's reply passes the turn back to White" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:95 — "A newly held piece replaces the earlier selected source" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:103 — "White cannot move again before Black's reply" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:113 — "A legal capture removes its victim and sounds once" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:121 — "An illegal selected destination clears selection without a move" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:130 — "An illegal dragged destination returns the piece without a move" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:139 — "An own piece cannot be captured" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:148 — "A move that keeps its king in check is refused" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:179 — "Dropping a piece on its own square puts it down without a move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:194 — "Dragging an opposing piece cannot offer a move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-interaction.feature:224 — "Checkmate announces the result with each sound once" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-motion.feature — 0 blocking, 5 warnings

B16 warn specs/chess-board/board-motion.feature:40 — "An opponent reply preserves a capture still arriving at its valid destination" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-motion.feature:48 — "A rapid legal capture sequence settles at its final position without losing move order" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-motion.feature:56 — "An old arrival cannot restore pieces after turning and replacement" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-motion.feature:64 — "An earlier capture cannot finish a newer capture at the same destination" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-motion.feature:78 — "An earlier arrival cannot alter a newly opened chessboard" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-opening.feature — 0 blocking, 3 warnings

B16 warn specs/chess-board/board-opening.feature:21 — "A fresh chessboard has no selection or annotations" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-opening.feature:50 — "Reopening the original position forgets an unconfirmed move and selection" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B11 warn specs/chess-board/board-opening.feature:6 — "Alice's activity has no chessboard yet" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
### specs/chess-board/board-options.feature — 0 blocking, 4 warnings

B16 warn specs/chess-board/board-options.feature:45 — "Holding another piece clears the earlier selection before a move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-options.feature:111 — "A preview cannot begin a promotion choice" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-options.feature:128 — "A fixed preview width wins over wider available space" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-options.feature:181 — "Removing a fixed width preserves promotion when the available space is now playable" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-premoves.feature — 0 blocking, 6 warnings

B16 warn specs/chess-board/board-premoves.feature:23 — "Repeating a waiting move keeps exactly one preview and queued move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-premoves.feature:58 — "Disabled premoves refuse queueing a waiting-side move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-premoves.feature:80 — "Two queued premoves keep the second waiting after the first reply" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-premoves.feature:111 — "Escape clears two queued premoves and the waiting selection" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-premoves.feature:119 — "A later opponent reply cannot execute cancelled premoves" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-premoves.feature:134 — "A refused personal circle clears every queued premove and preview" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-promotion.feature — 0 blocking, 1 warnings

B16 warn specs/chess-board/board-promotion.feature:16 — "Disabled input cannot request a promotion choice" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess-board/board-sound.feature — 0 blocking, 0 warnings

All A/B prose and shape checks pass by current read; genuine C/D evidence and pending execution handoff are described below.
### specs/chess-board/board-special-moves.feature — 0 blocking, 8 warnings

B16 warn specs/chess-board/board-special-moves.feature:8 — "Each castling direction completes both pieces for either side" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:34 — "Castling across check keeps both pieces in place" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:43 — "Dragging the king to its castling destination completes both White pieces" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:64 — "An en passant capture removes the pawn from its own square" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:73 — "An expired en passant opportunity cannot remove either pawn" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:112 — "Black's capture-promotion respects the Black orientation" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:142 — "Another piece can move before promotion has been requested" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess-board/board-special-moves.feature:150 — "Another piece cannot move while the promotion choice waits" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
### specs/chess/puzzle-sound.feature — 0 blocking, 17 warnings

B16 warn specs/chess/puzzle-sound.feature:8 — "Enabled sounds accompany a puzzle move and its opponent reply" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:17 — "Disabled sounds keep a puzzle move and its opponent reply silent" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:26 — "Enabled sounds accompany the puzzle's capture" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:35 — "A resumed puzzle completes its capture feedback after sounds are enabled" — 7 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:45 — "Disabled sounds keep the puzzle's capture silent" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:53 — "Enabled sounds accompany a wrong puzzle move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:62 — "Disabled sounds keep wrong-move feedback silent" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:72 — "Turning sounds off preserves the unfinished puzzle" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:80 — "A puzzle already open follows a later silence choice" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:88 — "Turning sounds on preserves the unfinished puzzle" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:97 — "Enabling sounds preserves the reached opening without repeating its setup sound" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:106 — "Enabling sounds after a silent solve does not repeat solved feedback" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:116 — "An enabled review sounds its next move" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B16 warn specs/chess/puzzle-sound.feature:124 — "A muted review remains silent while its position changes" — 6 steps; above standard five-step warning, mission maximum seven is satisfied.
B11 warn specs/chess/puzzle-sound.feature:6 — "Alice is signed in" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
B11 warn specs/chess/puzzle-sound.feature:70 — "Alice is signed in" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.
B11 warn specs/chess/puzzle-sound.feature:114 — "Alice is signed in" — Every scenario of this Rule repeats the same opening fact; may factor a Rule Background if it improves readability.

## Coverage

All commands are classified by their /// comment as a person input or activity/time/visibility/retained-arrival world event. No unobserved event is invented. init/step and private helpers are setup/plumbing per audit standard. Each model is local/offline as declared. No events.qnt variants are published in ChessBoard: C3 is not applicable. Borrowing Chess legality and Runtime controls/sounds is language/support, not an unhandled upstream event policy: C5 has no extra event row. Wrong legal puzzle move belongs the existing Chess playWrongMove aggregate action; this new sound projection intentionally bounds three prepared quiet/capture/review outcomes, while Gherkin gives the existing action muted/enabled outcomes.

### specs/chess-board/board-lifecycle.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | selectPiece (specs/chess-board/board-lifecycle.qnt:35) | specs/chess-board/board-interaction.feature:8 | covered |
| command/world event | beginDrag (specs/chess-board/board-lifecycle.qnt:41) | specs/chess-board/board-options.feature:38 | covered |
| command/world event | cancelDrag (specs/chess-board/board-lifecycle.qnt:47) | specs/chess-board/board-authority.feature:110 | covered |
| command/world event | switchAway (specs/chess-board/board-lifecycle.qnt:52) | specs/chess-board/board-authority.feature:118 | covered |
| command/world event | movePiece (specs/chess-board/board-lifecycle.qnt:57) | specs/chess-board/board-interaction.feature:113 | covered |
| command/world event | receiveReply (specs/chess-board/board-lifecycle.qnt:64) | specs/chess-board/board-motion.feature:40 | covered |
| command/world event | replacePosition (specs/chess-board/board-lifecycle.qnt:72) | specs/chess-board/board-authority.feature:45 | covered |
| command/world event | supplyUnusablePosition (specs/chess-board/board-lifecycle.qnt:80) | specs/chess-board/board-authority.feature:159 | covered |
| command/world event | configureBoard (specs/chess-board/board-lifecycle.qnt:84) | specs/chess-board/board-authority.feature:15 | covered |
| command/world event | flipBoard (specs/chess-board/board-lifecycle.qnt:92) | specs/chess-board/board-annotations.feature:208 | covered |
| command/world event | resizeBoard (specs/chess-board/board-lifecycle.qnt:98) | specs/chess-board/board-authority.feature:100 | covered |
| command/world event | finishAnimation (specs/chess-board/board-lifecycle.qnt:103) | specs/chess-board/board-motion.feature:22 | covered |
| command/world event | finishEarlierAnimation (specs/chess-board/board-lifecycle.qnt:108) | specs/chess-board/board-motion.feature:64 | covered |
| command/world event | setVisibility (specs/chess-board/board-lifecycle.qnt:112) | specs/chess-board/board-motion.feature:110 | covered |
| command/world event | closeBoard (specs/chess-board/board-lifecycle.qnt:119) | specs/chess-board/board-sound.feature:47 | covered |
| command/world event | startBoardWithUnusablePosition (specs/chess-board/board-lifecycle.qnt:127) | specs/chess-board/board-authority.feature:166 | covered |
| command/world event | startBoard (specs/chess-board/board-lifecycle.qnt:131) | specs/chess-board/board-opening.feature:9 | covered |
| invariant | invDisplayedPosition (specs/chess-board/board-lifecycle.qnt:149) | specs/chess-board/board-motion.feature:64 | covered |
| invariant | invCaptureRemnant (specs/chess-board/board-lifecycle.qnt:153) | specs/chess-board/board-motion.feature:64 | covered |
| invariant | invDisabled (specs/chess-board/board-lifecycle.qnt:157) | specs/chess-board/board-authority.feature:15 | covered |
| invariant | invReducedMotion (specs/chess-board/board-lifecycle.qnt:159) | specs/chess-board/board-motion.feature:94 | covered |
| invariant | invHidden (specs/chess-board/board-lifecycle.qnt:161) | specs/chess-board/board-motion.feature:110 | covered |
| invariant | invOneGesture (specs/chess-board/board-lifecycle.qnt:163) | specs/chess-board/board-options.feature:45 | covered |
| invariant | invClosed (specs/chess-board/board-lifecycle.qnt:165) | specs/chess-board/board-motion.feature:72 | covered |
| invariant | invSettings (specs/chess-board/board-lifecycle.qnt:168) | model-only: /// qnt line bounds orientation for present board and closed absence/settings; effects are separately observed by other safety invariants | model-only |
| temporal safety/progress | liveAnimationFinishes (specs/chess-board/board-lifecycle.qnt:173) | specs/chess-board/board-motion.feature:22; weak fairness of actual current-arrival finishing yields eventually no remnant and latest full display | covered |
| transition/illegal | selection false -> true | specs/chess-board/board-interaction.feature:8 | covered |
| transition/illegal | selection true -> false | specs/chess-board/board-interaction.feature:29 | covered |
| transition/illegal | holding false -> true | specs/chess-board/board-options.feature:38 | covered |
| transition/illegal | holding true -> false: cancel/resize/disable | specs/chess-board/board-authority.feature:110 | covered |
| transition/illegal | input true -> false | specs/chess-board/board-authority.feature:15 | covered |
| transition/illegal | input false -> true | specs/chess-board/board-authority.feature:36 | covered |
| transition/illegal | animation false -> true | specs/chess-board/board-motion.feature:88 | covered |
| transition/illegal | animation true -> false | specs/chess-board/board-motion.feature:22 | covered |
| transition/illegal | reduced-motion false -> true | specs/chess-board/board-motion.feature:94 | covered |
| transition/illegal | sound true -> false | specs/chess-board/board-sound.feature:34 | covered |
| transition/illegal | sound false -> true (prepared history) | specs/chess-board/board-sound.feature:28 | covered |
| transition/illegal | visible true -> false -> true | specs/chess-board/board-motion.feature:110 | covered |
| transition/illegal | White -> Black | specs/chess-board/board-authority.feature:84 | covered |
| transition/illegal | Black -> White | specs/chess-board/board-annotations.feature:208 | covered |
| transition/illegal | illegal disabled move | specs/chess-board/board-options.feature:89 | covered |
| transition/illegal | illegal empty/opponent source | specs/chess-board/board-interaction.feature:49 | covered |
| transition/illegal | current capture -> Black reply while arriving | specs/chess-board/board-motion.feature:40 | covered |
| transition/illegal | capture arrival -> equivalent confirmation preserved | specs/chess-board/board-motion.feature:29 | covered |
| transition/illegal | captureA -> replacementB -> captureA, earlier completion preserves newer arrival | specs/chess-board/board-motion.feature:64 | covered |
| transition/illegal | open -> closed, earlier completion preserves closure | specs/chess-board/board-motion.feature:72 | covered |
| transition/illegal | closed -> new normal opening, earlier completion preserves new board | specs/chess-board/board-motion.feature:78 | covered |
| transition/illegal | unusable supply ignored | specs/chess-board/board-authority.feature:159 | covered |
| transition/illegal | unusable initial supply -> normal opening | specs/chess-board/board-authority.feature:166 | covered |
| transition/illegal | closed -> normal opening facing White/Black | specs/chess-board/board-opening.feature:9 | covered |
| transition/illegal | closed unconfirmed local move/selection -> parent opening without prior marks | specs/chess-board/board-opening.feature:50 | covered |
### specs/chess-board/board-promotion.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | requestPromotion (specs/chess-board/board-promotion.qnt:23) | specs/chess-board/board-special-moves.feature:91 | covered |
| command/world event | choosePromotion (specs/chess-board/board-promotion.qnt:31) | specs/chess-board/board-special-moves.feature:98 | covered |
| command/world event | cancelPromotion (specs/chess-board/board-promotion.qnt:38) | specs/chess-board/board-special-moves.feature:121 | covered |
| command/world event | tryOtherPromotionMove (specs/chess-board/board-promotion.qnt:40) | specs/chess-board/board-special-moves.feature:142 | covered |
| command/world event | configurePromotionInput (specs/chess-board/board-promotion.qnt:45) | specs/chess-board/board-authority.feature:36 | covered |
| command/world event | configureAutomaticQueen (specs/chess-board/board-promotion.qnt:50) | specs/chess-board/board-authority.feature:174 | covered |
| command/world event | replacePromotionPosition (specs/chess-board/board-promotion.qnt:54) | specs/chess-board/board-authority.feature:59 | covered |
| invariant | invPendingPromotion (specs/chess-board/board-promotion.qnt:70) | specs/chess-board/board-special-moves.feature:150 | covered |
| invariant | invPromotedPiece (specs/chess-board/board-promotion.qnt:74) | specs/chess-board/board-special-moves.feature:98 | covered |
| invariant | invOnePromotionOffer (specs/chess-board/board-promotion.qnt:77) | specs/chess-board/board-special-moves.feature:98 | covered |
| invariant | invPromotionAuthority (specs/chess-board/board-promotion.qnt:82) | specs/chess-board/board-promotion.feature:16 | covered |
| invariant | invPromotionPositions (specs/chess-board/board-promotion.qnt:86) | model-only: finite prepared-position universe | model-only |
| transition/illegal | choice false -> true | specs/chess-board/board-special-moves.feature:91 | covered |
| transition/illegal | choice true -> false by choose | specs/chess-board/board-special-moves.feature:98 | covered |
| transition/illegal | choice true -> false by cancel | specs/chess-board/board-special-moves.feature:121 | covered |
| transition/illegal | ready -> promoted automatically | specs/chess-board/board-special-moves.feature:158 | covered |
| transition/illegal | ready -> rook moved | specs/chess-board/board-special-moves.feature:142 | covered |
| transition/illegal | interactive true -> false | specs/chess-board/board-promotion.feature:16 | covered |
| transition/illegal | interactive false -> true | specs/chess-board/board-authority.feature:36 | covered |
| transition/illegal | automatic false -> true | specs/chess-board/board-authority.feature:174 | covered |
| transition/illegal | automatic true -> false | specs/chess-board/board-authority.feature:180 | covered |
| transition/illegal | pending -> replacement | specs/chess-board/board-authority.feature:59 | covered |
| transition/illegal | illegal other move pending | specs/chess-board/board-special-moves.feature:150 | covered |
| transition/illegal | illegal after checkmate/stalemate | specs/chess-board/board-interaction.feature:261 | covered |
| transition/illegal | Escape without pending preserves board (genuine available event) | specs/chess-board/board-promotion.feature:49 | covered |
### specs/chess-board/board-premoves.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | selectPremoveSource (specs/chess-board/board-premoves.qnt:29) | specs/chess-board/board-premoves.feature:31 | covered |
| command/world event | queuePremove (specs/chess-board/board-premoves.qnt:39) | specs/chess-board/board-premoves.feature:8 | covered |
| command/world event | receivePremoveReply (specs/chess-board/board-premoves.qnt:49) | specs/chess-board/board-premoves.feature:73 | covered |
| command/world event | invalidatePremove (specs/chess-board/board-premoves.qnt:63) | specs/chess-board/board-premoves.feature:95 | covered |
| command/world event | cancelPremoves (specs/chess-board/board-premoves.qnt:71) | specs/chess-board/board-premoves.feature:111 | covered |
| command/world event | configurePremoves (specs/chess-board/board-premoves.qnt:75) | specs/chess-board/board-premoves.feature:66 | covered |
| command/world event | replacePremovePosition (specs/chess-board/board-premoves.qnt:81) | specs/chess-board/board-premoves.feature:157 | covered |
| invariant | invPremoveQueue (specs/chess-board/board-premoves.qnt:93) | specs/chess-board/board-premoves.feature:23 | covered |
| invariant | invOnePremovePerReply (specs/chess-board/board-premoves.qnt:97) | specs/chess-board/board-premoves.feature:80 | covered |
| invariant | invPremovePreview (specs/chess-board/board-premoves.qnt:100) | specs/chess-board/board-premoves.feature:8 | covered |
| invariant | invDisabledPremoves (specs/chess-board/board-premoves.qnt:103) | specs/chess-board/board-premoves.feature:150 | covered |
| invariant | invPremovePosition (specs/chess-board/board-premoves.qnt:106) | model-only: two prepared reply bounds and prepared move/square membership | model-only |
| invariant | invPremoveReplacement (specs/chess-board/board-premoves.qnt:112) | specs/chess-board/board-premoves.feature:157 | covered |
| transition/illegal | source none -> selected | specs/chess-board/board-premoves.feature:31 | covered |
| transition/illegal | source selected -> none | specs/chess-board/board-premoves.feature:104 | covered |
| transition/illegal | enabled false -> true | specs/chess-board/board-premoves.feature:66 | covered |
| transition/illegal | enabled true -> false | specs/chess-board/board-premoves.feature:150 | covered |
| transition/illegal | waiting remains true with first of two moves | specs/chess-board/board-premoves.feature:80 | covered |
| transition/illegal | waiting true -> false with invalidation | specs/chess-board/board-premoves.feature:95 | covered |
| transition/illegal | replacement false -> true | specs/chess-board/board-premoves.feature:157 | covered |
| transition/illegal | illegal disabled selection | specs/chess-board/board-premoves.feature:51 | covered |
| transition/illegal | illegal disabled queue | specs/chess-board/board-premoves.feature:58 | covered |
| transition/illegal | duplicate queue remains single | specs/chess-board/board-premoves.feature:23 | covered |
| transition/illegal | selected waiting source -> none by choosing same source | specs/chess-board/board-premoves.feature:37 | covered |
| transition/illegal | selected waiting source -> another waiting source | specs/chess-board/board-premoves.feature:44 | covered |
| transition/illegal | empty moved former source -> next queue cleared | specs/chess-board/board-premoves.feature:143 | covered |
### specs/chess-board/board-annotations.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | beginPersonalArrow (specs/chess-board/board-annotations.qnt:42) | specs/chess-board/board-annotations.feature:158 | covered |
| command/world event | finishPersonalArrow (specs/chess-board/board-annotations.qnt:48) | specs/chess-board/board-annotations.feature:97 | covered |
| command/world event | cancelPersonalArrow (specs/chess-board/board-annotations.qnt:57) | specs/chess-board/board-annotations.feature:164 | covered |
| command/world event | togglePersonalCircle (specs/chess-board/board-annotations.qnt:61) | specs/chess-board/board-annotations.feature:119 | covered |
| command/world event | clearPersonalAnnotations (specs/chess-board/board-annotations.qnt:69) | specs/chess-board/board-annotations.feature:46 | covered |
| command/world event | setActivityArrows (specs/chess-board/board-annotations.qnt:75) | specs/chess-board/board-annotations.feature:30 | covered |
| command/world event | setActivitySquareMarks (specs/chess-board/board-annotations.qnt:79) | specs/chess-board/board-annotations.feature:38 | covered |
| command/world event | chooseActivityArrow (specs/chess-board/board-annotations.qnt:83) | specs/chess-board/board-feedback.feature:9 | covered |
| command/world event | supplyFeedbackMarks (specs/chess-board/board-annotations.qnt:88) | specs/chess-board/board-feedback.feature:30 | covered |
| command/world event | clearActivityAnnotations (specs/chess-board/board-annotations.qnt:95) | specs/chess-board/board-annotations.feature:89 | covered |
| command/world event | configurePersonalAnnotations (specs/chess-board/board-annotations.qnt:99) | specs/chess-board/board-annotations.feature:177 | covered |
| command/world event | flipAnnotationBoard (specs/chess-board/board-annotations.qnt:104) | specs/chess-board/board-annotations.feature:208 | covered |
| command/world event | replaceAnnotationPosition (specs/chess-board/board-annotations.qnt:109) | specs/chess-board/board-annotations.feature:183 | covered |
| invariant | invPersonalSquares (specs/chess-board/board-annotations.qnt:129) | specs/chess-board/board-annotations.feature:208 | covered |
| invariant | invActivitySquares (specs/chess-board/board-annotations.qnt:133) | specs/chess-board/board-annotations.feature:30 | covered |
| invariant | invDisabledAnnotations (specs/chess-board/board-annotations.qnt:137) | specs/chess-board/board-annotations.feature:171 | covered |
| invariant | invArrowOffer (specs/chess-board/board-annotations.qnt:139) | specs/chess-board/board-annotations.feature:135 | covered |
| invariant | invAnnotationPosition (specs/chess-board/board-annotations.qnt:143) | specs/chess-board/board-annotations.feature:208 | covered |
| transition/illegal | pending none -> arrow | specs/chess-board/board-annotations.feature:158 | covered |
| transition/illegal | pending arrow -> none: finish | specs/chess-board/board-annotations.feature:97 | covered |
| transition/illegal | pending arrow -> none: cancel/disable/flip/replace | specs/chess-board/board-annotations.feature:164 | covered |
| transition/illegal | enabled false -> true | specs/chess-board/board-annotations.feature:177 | covered |
| transition/illegal | enabled true -> false | specs/chess-board/board-annotations.feature:171 | covered |
| transition/illegal | White -> Black | specs/chess-board/board-annotations.feature:194 | covered |
| transition/illegal | Black -> White | specs/chess-board/board-annotations.feature:208 | covered |
| transition/illegal | personal arrow absent -> present | specs/chess-board/board-annotations.feature:97 | covered |
| transition/illegal | personal arrow present -> absent | specs/chess-board/board-annotations.feature:106 | covered |
| transition/illegal | personal circle absent -> present | specs/chess-board/board-annotations.feature:119 | covered |
| transition/illegal | personal circle present -> absent | specs/chess-board/board-annotations.feature:128 | covered |
| transition/illegal | activity marks absent -> present | specs/chess-board/board-annotations.feature:38 | covered |
| transition/illegal | activity marks present -> absent | specs/chess-board/board-annotations.feature:89 | covered |
| transition/illegal | illegal personal drawing while disabled | specs/chess-board/board-annotations.feature:142 | covered |
| transition/illegal | disabled completed personal marks -> cleared by genuine piece selection | specs/chess-board/board-annotations.feature:54 | covered |
| transition/illegal | disabled completed personal marks -> cleared by keyboard selection | specs/chess-board/board-annotations.feature:64 | covered |
| transition/illegal | personal marks -> cleared by empty square | specs/chess-board/board-annotations.feature:81 | covered |
| transition/illegal | arrow default/danger/bright-green/bright-green-dashed appearance supplied | specs/chess-board/board-feedback.feature:15 | covered |
| transition/illegal | feedback usual/centered/gold appearance supplied | specs/chess-board/board-feedback.feature:30 | covered |
| transition/illegal | centered feedback White -> Black retains assigned logical square | specs/chess-board/board-feedback.feature:50 | covered |
### specs/chess-board/board-options.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | selectOptionsPiece (specs/chess-board/board-options.qnt:36) | specs/chess-board/board-interaction.feature:8 | covered |
| command/world event | beginOptionsDrag (specs/chess-board/board-options.qnt:42) | specs/chess-board/board-options.feature:38 | covered |
| command/world event | moveOptionsPiece (specs/chess-board/board-options.qnt:48) | specs/chess-board/board-options.feature:32 | covered |
| command/world event | requestOptionsPromotion (specs/chess-board/board-options.qnt:55) | specs/chess-board/board-promotion.feature:9 | covered |
| command/world event | resizeAvailableSpace (specs/chess-board/board-options.qnt:62) | specs/chess-board/board-options.feature:173 | covered |
| command/world event | configureFixedWidth (specs/chess-board/board-options.qnt:67) | specs/chess-board/board-options.feature:20 | covered |
| command/world event | configureOptionsInput (specs/chess-board/board-options.qnt:72) | specs/chess-board/board-options.feature:89 | covered |
| command/world event | configureCoordinates (specs/chess-board/board-options.qnt:77) | specs/chess-board/board-options.feature:192 | covered |
| command/world event | configureLegalMarks (specs/chess-board/board-options.qnt:79) | specs/chess-board/board-options.feature:227 | covered |
| command/world event | configureLastMoveMarks (specs/chess-board/board-options.qnt:81) | specs/chess-board/board-options.feature:247 | covered |
| command/world event | configureBoardColors (specs/chess-board/board-options.qnt:83) | specs/chess-board/board-options.feature:256 | covered |
| command/world event | replaceOptionsPosition (specs/chess-board/board-options.qnt:88) | specs/chess-board/board-authority.feature:45 | covered |
| invariant | invOptionsAuthority (specs/chess-board/board-options.qnt:107) | specs/chess-board/board-options.feature:89 | covered |
| invariant | invOptionsGesture (specs/chess-board/board-options.qnt:110) | specs/chess-board/board-options.feature:45 | covered |
| invariant | invOptionsWidth (specs/chess-board/board-options.qnt:116) | specs/chess-board/board-options.feature:128 | covered |
| invariant | invOptionsPosition (specs/chess-board/board-options.qnt:122) | specs/chess-board/board-options.feature:275 | covered |
| transition/illegal | fixed width false -> true | specs/chess-board/board-options.feature:20 | covered |
| transition/illegal | fixed width true -> false | specs/chess-board/board-options.feature:26 | covered |
| transition/illegal | room broad -> narrow -> broad | specs/chess-board/board-options.feature:173 | covered |
| transition/illegal | fixed narrow beats broad available | specs/chess-board/board-options.feature:128 | covered |
| transition/illegal | coordinates false -> true | specs/chess-board/board-options.feature:192 | covered |
| transition/illegal | coordinates true -> false | specs/chess-board/board-options.feature:212 | covered |
| transition/illegal | legal marks true -> false | specs/chess-board/board-options.feature:220 | covered |
| transition/illegal | legal marks false -> true | specs/chess-board/board-options.feature:227 | covered |
| transition/illegal | last move marks true -> false | specs/chess-board/board-options.feature:241 | covered |
| transition/illegal | last move marks false -> true | specs/chess-board/board-options.feature:247 | covered |
| transition/illegal | colors brown -> green | specs/chess-board/board-options.feature:256 | covered |
| transition/illegal | colors green -> brown | specs/chess-board/board-options.feature:275 | covered |
| transition/illegal | select/held/promotion -> idle entering preview | specs/chess-board/board-options.feature:166 | covered |
| transition/illegal | illegal preview move/keyboard/promotion | specs/chess-board/board-options.feature:60 | covered |
| transition/illegal | illegal preview selection | specs/chess-board/board-options.feature:75 | covered |
| transition/illegal | illegal preview holding | specs/chess-board/board-options.feature:82 | covered |
| transition/illegal | illegal activity-disabled input supported width | specs/chess-board/board-options.feature:89 | covered |
### specs/chess-board/board-keyboard.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | moveKeyboard (specs/chess-board/board-keyboard.qnt:38) | specs/chess-board/board-accessibility.feature:39 | covered |
| command/world event | chooseKeyboardSquare (specs/chess-board/board-keyboard.qnt:49) | specs/chess-board/board-accessibility.feature:93 | covered |
| command/world event | tapKeyboardSquare (specs/chess-board/board-keyboard.qnt:55) | specs/chess-board/board-accessibility.feature:149 | covered |
| invariant | invKeyboardSquare (specs/chess-board/board-keyboard.qnt:67) | specs/chess-board/board-accessibility.feature:78 | covered |
| invariant | invKeyboardMove (specs/chess-board/board-keyboard.qnt:70) | specs/chess-board/board-accessibility.feature:134 | covered |
| invariant | invKeyboardAuthority (specs/chess-board/board-keyboard.qnt:75) | specs/chess-board/board-accessibility.feature:122 | covered |
| transition/illegal | initial facing White/Black -> a1/h8 entry | specs/chess-board/board-opening.feature:31 | covered |
| transition/illegal | four screen directions, White | specs/chess-board/board-accessibility.feature:39 | covered |
| transition/illegal | four screen directions, Black | specs/chess-board/board-accessibility.feature:52 | covered |
| transition/illegal | four edge travel attempts clamp, each orientation | specs/chess-board/board-accessibility.feature:78 | covered |
| transition/illegal | none -> selected with each Space/Enter | specs/chess-board/board-accessibility.feature:93 | covered |
| transition/illegal | selected -> none with each Space/Enter | specs/chess-board/board-accessibility.feature:104 | covered |
| transition/illegal | selected pawn -> completed e2e4 through Space | specs/chess-board/board-accessibility.feature:115 | covered |
| transition/illegal | selected knight -> completed g1f3 through Enter, both orientations | specs/chess-board/board-accessibility.feature:134 | covered |
| transition/illegal | tap source/destination updates keyboard identity | specs/chess-board/board-accessibility.feature:155 | covered |
| transition/illegal | illegal disabled choice, both keys | specs/chess-board/board-accessibility.feature:122 | covered |
### specs/chess-board/board-independence.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | selectSeparatePiece (specs/chess-board/board-independence.qnt:27) | specs/chess-board/board-independence.feature:17 | covered |
| command/world event | beginSeparateDrag (specs/chess-board/board-independence.qnt:33) | specs/chess-board/board-independence.feature:24 | covered |
| command/world event | cancelSeparateDrag (specs/chess-board/board-independence.qnt:39) | specs/chess-board/board-independence.feature:33 | covered |
| command/world event | moveSeparatePiece (specs/chess-board/board-independence.qnt:45) | specs/chess-board/board-independence.feature:9 | covered |
| command/world event | configureSeparateInput (specs/chess-board/board-independence.qnt:59) | specs/chess-board/board-independence.feature:58 | covered |
| command/world event | configureSeparateSound (specs/chess-board/board-independence.qnt:66) | specs/chess-board/board-independence.feature:79 | covered |
| command/world event | replaceSeparatePosition (specs/chess-board/board-independence.qnt:71) | specs/chess-board/board-independence.feature:40 | covered |
| command/world event | closeSeparateBoard (specs/chess-board/board-independence.qnt:77) | specs/chess-board/board-independence.feature:103 | covered |
| invariant | invSeparateGestures (specs/chess-board/board-independence.qnt:92) | specs/chess-board/board-independence.feature:51 | covered |
| invariant | invSeparatePositions (specs/chess-board/board-independence.qnt:95) | specs/chess-board/board-independence.feature:40 | covered |
| invariant | invSeparateOffers (specs/chess-board/board-independence.qnt:100) | specs/chess-board/board-independence.feature:93 | covered |
| transition/illegal | each addressed source absent -> selected | specs/chess-board/board-independence.feature:17 | covered |
| transition/illegal | addressed selected -> held, other choice preserved | specs/chess-board/board-independence.feature:24 | covered |
| transition/illegal | addressed held -> released | specs/chess-board/board-independence.feature:33 | covered |
| transition/illegal | addressed opening -> completed move, other position/selection intact | specs/chess-board/board-independence.feature:9 | covered |
| transition/illegal | addressed input true -> false clears its choice | specs/chess-board/board-independence.feature:51 | covered |
| transition/illegal | addressed input false -> true | specs/chess-board/board-independence.feature:58 | covered |
| transition/illegal | illegal disabled addressed move does not disturb other | specs/chess-board/board-independence.feature:64 | covered |
| transition/illegal | addressed sound true -> false | specs/chess-board/board-independence.feature:72 | covered |
| transition/illegal | addressed sound false -> true | specs/chess-board/board-independence.feature:79 | covered |
| transition/illegal | unmuted other board still sounds | specs/chess-board/board-independence.feature:86 | covered |
| transition/illegal | muted addressed move keeps global tape unchanged | specs/chess-board/board-independence.feature:93 | covered |
| transition/illegal | addressed position -> replacement | specs/chess-board/board-independence.feature:40 | covered |
| transition/illegal | one present -> absent, other keeps choice/input | specs/chess-board/board-independence.feature:103 | covered |
| transition/illegal | survivor moves/sounds after other closes | specs/chess-board/board-independence.feature:112 | covered |
### specs/chess/puzzle-sound.qnt

| Kind | Model/transition | Exact example/evidence | Status |
| --- | --- | --- | --- |
| command/world event | playQuietPuzzleMove (specs/chess/puzzle-sound.qnt:19) | specs/chess/puzzle-sound.feature:8 | covered |
| command/world event | playCapturePuzzleMove (specs/chess/puzzle-sound.qnt:25) | specs/chess/puzzle-sound.feature:26 | covered |
| command/world event | stepPuzzleSoundReview (specs/chess/puzzle-sound.qnt:31) | specs/chess/puzzle-sound.feature:116 | covered |
| command/world event | configurePuzzleSounds (specs/chess/puzzle-sound.qnt:37) | specs/chess/puzzle-sound.feature:88 | covered |
| invariant | invPuzzleSilence (specs/chess/puzzle-sound.qnt:45) | specs/chess/puzzle-sound.feature:45 | covered |
| invariant | invPuzzleSoundPosition (specs/chess/puzzle-sound.qnt:47) | specs/chess/puzzle-sound.feature:97 | covered |
| transition/illegal | quiet move1 -> move3, actual move/correct feedback | specs/chess/puzzle-sound.feature:8 | covered |
| transition/illegal | capture move1 -> solved move2, actual capture/solved/rating gain | specs/chess/puzzle-sound.feature:26 | covered |
| transition/illegal | review move3 -> move4, move/check/end | specs/chess/puzzle-sound.feature:116 | covered |
| transition/illegal | sounds true -> false preserves unfinished progress | specs/chess/puzzle-sound.feature:72 | covered |
| transition/illegal | sounds false -> true preserves unfinished progress | specs/chess/puzzle-sound.feature:88 | covered |
| transition/illegal | muted quiet/capture/review/wrong legal move has no actual playback | specs/chess/puzzle-sound.feature:62 | covered |
| transition/illegal | returned unfinished puzzle obeys later mute | specs/chess/puzzle-sound.feature:80 | covered |
| transition/illegal | silent reached initial opponent opening -> sounds on, no repeat | specs/chess/puzzle-sound.feature:97 | covered |
| transition/illegal | silent solved puzzle -> sounds on, no solved-feedback repeat | specs/chess/puzzle-sound.feature:106 | covered |

## Steps and observable-model integrity

ChessBoard old/frozen action keys and observations were independently read in full. Source model events use actual public setup/input/configuration/actions; observations never return expected Quint state. Final startBoard and annotation-appearance keys, keyboard key/file/rank/selectedSource and both prepared full canonical position projections are exact genuinely bound actions and1022/0 green. Public initial opening read guards full canonical FEN/full32 painted pieces and actual default status/check/320-width/input/picker/premove/overlay state; actual first roving square is read before forced focus. Another real activity control keeps active focus on mount. Enter knight Given actually focuses g1 and presses Enter, guards actual selected/cursor g1, then focuses f3, preserving both halves of the old route; both orientation examples green.

Lifecycle actual observer independently classifies complete canonical fixture FENs via chess.js and complete DOM piece identities, including closed absent attachment, displayedPosition and actual ghost/native activity. Earlier-completion availability comes from the actual retained registered cancelled callback, not copied model history or a bounded position counter. Actual old handle is consumed independently of current handle across captureA/replacementB/newCaptureA and disposal/reopen. Valid current per-piece pawn/knight arrivals may overlap; only genuinely abandoned arrivals retire. Weak-fair finishing requires current display settled at latest full position with no remnant, beyond merely a false transition bit.

Annotation reads actual rendered arrow/stroke/feedback attributes and actual callback arrays; latest-action arrowOffers comes from callback-history cursor reset once per real input, never reconstructed outcome. Full arrow callback checks primary color and stable endpoint id already. Final chosen theme/default/danger/hex/dash and badge glyph/color/placement/name effects are read from actual SVG paths/text/stroke/fill/dash/opacity and relative geometry; final examples/model green. Actual latest personal-arrow callback snapshot survives measurement reset. Actual rendered multiset subtraction preserves identical personal/activity multiplicities and removes the prior incorrect primary-color ownership heuristic; no configuration or expected model sets populate the observation. Options width/colors/legal/last/coordinate effects are real measured DOM/probe values; supplied choice facts may fill opportunities absent from the prepared current position, but examples with actual marks independently prove effects. Promotion actual chooser controls/names/queen focus, Escape/cancel source focus and pick destination focus are observed, with pending-choice guards and actual Escape available before picker. Premoves observe true queue/previews/actual canonical prepared replies/callbacks; two-entry selected Escape and disabled-circle right h6 are now explicit strongest examples.

Pair genuinely creates two separate mounted ChessBoards and independent root-scoped inputs/reads. Each actual full canonical FEN/paint/selection/holding/input/callback list and closed attachment are observed. One shared actual playback tape avoids invented creator/source ownership; separate board sound choices plus an addressed move and exact global tape prove mute independence. Fingerprints include full actual markup/state/callback/audio rather than expected outcomes. Each distinct actual markup string is audited once per app lifetime, rather than only initial markup.

Consumer sound actions operate real solve/review/wrong-legal-move UI plus injected actual playback records. Actual tape length is captured at fixture init to exclude prior unrelated preparation. Latest-action boundary cannot discard playback produced during configuration/return, and the model fingerprint retains actual tape since init. Sound classes correct move/solved/rating gain are inferred only within the declared prepared fixture class; no per-player ownership is invented. Returned unfinished puzzle is a real return/remount history, not unchanged-instance proof. New reached-opening/solved no-repeat examples explicitly preserve product truth. Exact capture literal compares the entire actual sorted tape with exactly three cues; wrong cue occurs once, mute entire tape empty. Heard Set cannot substitute duplicate-count proof. Consumer review-board proof now calls @libs/chess/harness/chess-puzzle-review-ui/readRenderedPuzzleReviewBoard; the public board driver is confined to the harness seam. D2 correction is closed.

## Named checks

| Check | Current evidence/result |
| --- | --- |
| A0 | Each feature/glossary definition/model header is business prose; no internal parser/protocol/cache/generation requirement is written for people. Exact ms/compositor/FEN payload is kept in code proof. |
| A1 | Own ChessBoard/Chess language, borrowed Chess/Runtime published lenders and shared kernel plus all repository glossaries were searched; file/rank, visible remnant, selected/held/preview, arrow/badge appearance, Space/Enter/control are resolved. |
| A2 | Local avoid synonyms absent from current prose; corrected consumer repeat title avoids forbidden replay synonym. |
| A3 | PASS: latest spec commit 1e1f01ac5 records mission confirmation of Enter key, primary color, danger color and feedback badge;90db3 extends forms of already-owned terms. |
| A4 | Runtime sounds/control are published and explicitly borrowed; Chess is lender of chess/position/piece legality language. No illegal Quint cross-context import. |
| A5 | No unexempt transport or implementation jargon; pixels are deliberate observable width choice, no sub-second business thresholds. |
| A6 | Alice, her activity, settings and chessboard are glossary/cast subjects. |
| B1 | All capability titles are business phrases. |
| B2 | All job stories express When/wants/so. |
| B3 | All examples lie under named Rules. |
| B4 | Every Rule has exact closed-marker positive+negative or truthful unconditional first-line No counter-example. Opening is-not-taken wording corrected to cannot; Black drawn announcement happy wording is marker-free. |
| B5 | Exactly one When including intervening And/But, max7; no When after Then. |
| B6 | Context clauses are facts, including already played/closed/cancelled/returned histories. No enabled-sounds setup imperative remains. |
| B7 | One intent per When; complete move/drag is one interaction, six-ply history is Given and one final move is When. |
| B8 | Refusals name disabled/preview/off-turn/illegal/check/pinned/closed/edge reasons. No quote of arbitrary app copy or internal-count outcome. |
| B9 | Plan is deliberately supplied badge name, not quoted fixed app copy. Glyph/placement are deliberately observed user marks. |
| B10 | Outcome titles have verbs, are unique and contain no Test/Case/should. |
| B11 | No invalid/irrelevant Background. Repeated opening facts are warnings below only. |
| B12 | Outline dimensions piece/side/orientation/direction/edge/choice key/appearance are business distinctions; max6 rows. |
| B13 | No placeholder/seed/example-only technical values in business prose. |
| B14 | Canonical optional-pattern definitions unify duplicate body phrases; final strict duplicate registry has zero wording warnings and regenerated catalog is current. |
| B15 | Only recognized domain/regression tags; final draw/overlap/puzzle feedback regressions registered by root. Final strict gate confirms registered IDs. |
| B16 | 74 examples exceed standard5 warning; all <=7 user maximum. No >8 block. |
| B17 | Hidden-immediate observation demoted to model, visible return is genuine; exact mechanical counts/colors/payload preserved through public contracts where not business policy. |
| C1 | Every public modeled command has non-refusal happy example, including held intermediate, other promotion piece, chosen appearance and normal open. |
| C2 | Strongest selection→hold exclusivity, live remnant overlap/ABA/closed/new owner, two queues+selection cancel, wrong feedback and no-repeat histories explicit. Complete actual observations required, not expected flags. |
| C3 | No ChessBoard/puzzle-sound published events.qnt variants. |
| C4 | Legal and available refused statuses enumerated in maps; genuine waiting-side queue scope excludes own-turn ordinary move; absent chooser choose guarded while actual Escape remains available. Both Space/Enter disabled/source branches explicit. |
| C5 | No downstream event-policy relationship applicable beyond declared language/setting lenders. |
| C6 | Every When owns genuine model action/form (borrowed existing wrong-move action included), not same noun match. Actual earlier registered completion is a distinct world event; source guards prevent phantom absent-piece commands. |
| D1 | Specs have no package/path/private code identifiers in prose. |
| D2 | Board and consumer steps/bindings call public harness reads/actions and allowed registry/type seams. Consumer review driver now resides in public harness read; no direct UI-driver construction remains in binding. |
| D3 | Actual read/transform glue, no expected model state copying. Branches select prepared harness paths. Given guards only verify facts they built. |
| D4 | One composition per runner; final generated catalogs/unused/ambiguity gate green after author freeze. |
| D5 | Virtual time, no wall sleeps/retry/skip/pending tests in bound suites. |
| D6 | All seven final board model keys/projections exact and100×30 bound replay green, including startBoard/appearance and parameterized keyboard projection. Final consumer keys genuine,43/0 full closure green. |
| P1/P2 | Spec-only author commits; implementers read-only spec; auditor edits only /tmp. Parent final spec ownership gate green. |
| P3 | Product-red literal/model evidence precedes source fixes and known-bug regressions; all15 required distinct intended source mutants are meaningfully RED in /tmp/chess-board-mutations/RESULTS.json. Consumer compile-valid private import and3additional sound-authority mutants reject through the own-package gate. Full release Check remains root-owned. |
| P4 | PASS: all94declarations/102instantiatedcases across11files have exact COVERED rows, classification and green destinations in /tmp/chess-board-legacy-parity.md; original unchanged source snapshotc97567e39dc9151e0086b2c7c3573e5ef789c5bd with every blob retained. No handoff or missing claim remains; root owns deletion. |

## Summary

| Check | Author blocking | Warnings |
| --- | --- | --- |
| B11 | 0 | 10 |
| B16 | 0 | 74 |

## Triage

- Writer: final source prose/model freeze author-cleared; no text correction requested.
- Binder/root: final public default/focus/appearance/cancel/history reads, exact action parameters/projections, strict wording/catalog/ownership, all seven bound/formal models and narrow canonical capture fact are green. No binding/spec blocker remains. Root may retire legacy files against the completed102-case proof ledger.
- Root: consumer no-repeat/mute/delayed exact counts/public seam/import+authority conformance scopePASS. Mechanical75ms/zero/low-end/capability/identifier parity closed. Complete native capture-ring/label-edge/resize-orient→newer history proof and fresh affected gates, then full repository Verify. These mission obligations are independent of feature/model audit and legacy parity PASS.

No human clarification is needed: the mission and parent provide author intent. Feature/model/binding and legacy parity PASS are not a release verdict; full mission native closure and repository Verify remain required.
