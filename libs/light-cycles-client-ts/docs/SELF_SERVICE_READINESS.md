# Light Cycles board readiness evidence

This game-owned record feeds the coordinator's shared
[readiness matrix](../../../docs/SELF_SERVICE_READINESS.md). Rules remain in
[the Light Cycles specifications](../../../specs/light-cycles/).

| Task or state | Current presentation and verification | Remaining evidence |
| --- | --- | --- |
| Start steering with a keyboard | Wide and compact guidance names clicking or tabbing to the arena and arrow/WASD keys, including shared rider mappings. Literal compact-layout regressions pass. | Hosted capture of the revised compact guidance and actual Tab traversal. |
| Keep steering responsive | Frame readers retain one validated snapshot instead of decoding the same position for each score and rider status. The literal Quad regression reduces nine decoder calls to one and verifies changed/invalid position handling. | Matching hosted input/render measurements; earlier CPU4 results remain below the acceptance target. |
| Resume after interruption | The arena discards a held swipe when steering availability or local ownership changes. A new gesture works; the literal held-touch/reconnect regression passed. | Live reconnect, retained state and shell recovery action. |
| Understand rider state without the drawing | The arena's description names each rider's column, row, direction, queued turn and crashed state. It updates on demand without a live announcement every tick. | Accessibility-tree and assistive interaction evidence. This does not establish fully nonvisual spatial play. |
| Follow countdown, collision and end states | Existing production stories retain countdown, collision through next round, finished and watching states. | Current automated videos, action completion and current axe scans. |
| Recover an unreadable position or move control to this device | Existing app-version link and device-claim action remain. | End-to-end recovery and ownership-transfer proof. |

Scoped DOM, type and lint checks do not establish live transport, physical
device latency, sustained frame performance or release readiness. Per-revision
results, independent reviews and missing evidence are retained on PR 291.
The PR stays draft until
the full automated gate and fixed independent review contract pass.
