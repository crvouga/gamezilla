# Connect Four board readiness

This game-owned record supplies the Connect Four update for the coordinated
[self-service readiness matrix](../../docs/SELF_SERVICE_READINESS.md).
See the [task-completion evidence map](TASK_COMPLETION.md) for production-journey
coverage and the limits of isolated board captures.

| Journey | Failure or confusion | Resolution | Automated evidence | Remaining limitation |
| --- | --- | --- | --- | --- |
| Keep a keyboard destination while using the pointer | Moving off a hovered column erased the preview of a still-focused column | Separate pointer and focus lifetimes restore the focused destination | Literal and generated DOM regressions; eight paired native-browser mixed-input cases in runs `42434969251` / `42434970941` | Screen-reader speech and every pointer/key interleaving are not claimed |
| Activate with Enter or Space | A resting pointer advertised a different destination | Native keyboard activation restores the focused destination before dropping | DOM regressions and paired screenshots, videos and action traces | Expanded native traversal awaits its next hosted result |
| Recover from a full column | Refusal left the generic instruction visible | The board explains that the column is full and asks for another; discs stay intact | DOM regression, production `FullColumn` story and eight paired native refusal captures | Reconnect/write-rejection states belong to the shared session surface and are not proved by this capture |
| Discover keyboard controls | Focused columns described contents but omitted available keys | Keyboard focus reveals guidance; each column describes navigation and permitted activation | Literal red/green regression in `disc-drop-focus-preview.test.tsx`; production opening-story assertion | Browser capture of the new guidance pending; inactive guidance advertises inspection only |
| Drop, inspect a result, or watch | Input and inactive states must stay usable at supported sizes | Real-rule fixtures, column names, shape marks, guarded native controls and explicit outcomes | Forty-one focused tests per revision; 96 axe audits per revision with zero findings; four widths and both themes | At 320px the captured columns are 38px wide; compact-frame work and native boundary/cancel tests need new measurements |

Round 1 media and both independent reports are posted on
[PR 290](https://github.com/crvouga/gamezilla/pull/290#issuecomment-6718775531).
Both reviewers rated the captured candidate 9 for design, 9 for playability and
8 for responsiveness; the round is incomplete. Mobile timings include long tasks
and instrumentation overhead. Controlled recorded/unrecorded CPU-profile probes
and normal/reduced-motion tests are prepared for the next hosted diagnostic.

The changes preserve legal-action guards and introduce no network operation,
retry or support step. Hosted Verify PR `42436544028` passed on `0d7b32f`; newer
edits require a new gate. Full local verify remains prohibited by host resource
coordination. Native builds, physical-device latency and absent recovery coverage
are not claimed as passed. Final readiness still requires the fixed rubric and
all applicable checks on the final candidate.
