# Numberlink board readiness

This game's evidence supplements the central [self-service readiness matrix](../../docs/SELF_SERVICE_READINESS.md).
Product rules remain in [Numberlink specifications](../../specs/numberlink/).

| Surface | Recovery and accessibility evidence | Current limit |
| --- | --- | --- |
| Puzzle drawing | Literal DOM regressions preserve a saved path after a stationary tap, cancel an outside/reentry gesture, and route Escape to the pointer's starting cell. Existing contracts cover invalid paths, backtracking, disabled input and incoming state. | Native browser capture and live-app persistence must pass on the candidate before release. |
| Endpoint editing | A dashed board marker and live coordinate identify the selected endpoint independently of color and keyboard focus. The literal DOM regression checks switching endpoints and selection after placement. | Phone/tablet/desktop screenshots and browser accessibility are pending. |
| Input responsiveness | The game-owned Storybook browser suite records mouse, trusted touch and keyboard journeys, videos, accessibility results, input-to-frame samples and long tasks at normal and 4× CPU throttling. | Instrumentation is not a measurement result. Frame timing excludes paint completion and display latency; emulation is not a physical mobile device. |

Review rounds and immutable evidence are recorded on PR 286.
Both initial independent reviews are incomplete because inherited references differ from the candidate and fresh video/performance evidence is missing.
Scoped diagnostics do not replace the full verification gate.
