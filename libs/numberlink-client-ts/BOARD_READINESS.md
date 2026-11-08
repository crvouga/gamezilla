# Numberlink board readiness

This game's evidence supplements the central [self-service readiness matrix](../../docs/SELF_SERVICE_READINESS.md).
Product rules remain in [Numberlink specifications](../../specs/numberlink/).

| Surface | Recovery and accessibility evidence | Current limit |
| --- | --- | --- |
| Puzzle drawing | Seven literal DOM regressions cover stationary taps, boundary cancellation, Escape focus, cancellation explanation, saved-counter clarity, visible keyboard entry and editor selection. Candidate `60d0c12` passed 16 browser cases twice, compared with eight baseline failures. | New cancellation feedback and saved-counter wording need fresh browser evidence. Expanded completion, natural Tab entry, touch cancellation, dense-board and long-label recordings are implemented but have not run yet. |
| Endpoint editing | A dashed board marker and live coordinate identify the selected endpoint independently of color and keyboard focus. Both themes have verified screenshots, videos and empty axe violation reports for endpoint selection. | Actual placement, undo and recovery still need expanded browser evidence at supported sizes. |
| Input responsiveness | At `60d0c12`, eight viewport/theme conditions recorded 23 samples each. Phone-sized cases at 4× CPU throttle measured p95 36.8–48.2 ms to the next animation frame; two cases included 51/53 ms long tasks. | Single short recordings do not establish sustained performance. Timing excludes completed paint and display latency; desktop CPU throttling is not a physical mobile device. Dense-board measurements remain pending. |

Review rounds and immutable evidence are recorded on PR 286.
Round 1 has two independent reviews of authenticated fresh screenshots, decoded video frames, interaction traces and measurements. Their captured-state design/UX scores are 9.5/9.0 and 8.5/8.5; both full-scope and performance verdicts remain incomplete. The recorded candidate and newer green safety-gate revision are tracked separately on the PR.
Scoped diagnostics do not replace the full verification gate. The coordinator's host resource restriction still prevents a full local verification run.
