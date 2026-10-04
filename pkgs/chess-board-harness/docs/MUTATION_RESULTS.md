# Chessboard mutation evidence

Each source defect below was introduced alone, exercised by its named verifier,
and restored before normal verification. A timeout, setup error or empty test
filter does not qualify. This ledger records assertion failures, not a release
verdict; the complete gate is `bun check`.

| Injected defect | Intended verifier | Observed rejection |
| --- | --- | --- |
| Ignore parent sound-off | `board-sound.feature`, silent chessboard | Playback was recorded where silence was required. |
| Play again on equivalent confirmation | `board-authority.feature`, confirmation | A second move sound appeared. |
| Keep delayed sound after disabling | `sound-lifecycle.contract.test.tsx`, blocked seek | Disabled playback reached the audio port. |
| Restart an equivalent arrival | `piece-animator.test.ts`, re-placement | A replacement animation appeared instead of preserving the current handle. |
| Preserve an obsolete capture remnant | `board-motion.feature`, replacement | The old captured piece remained painted. |
| Duplicate every painted piece | `board-interaction.feature`, own piece selection | Painted pieces diverged from the latest position. |
| Round resized width to an eight-pixel grid | `board-geometry.contract.test.ts`, fractional dimensions | Fractional available width was lost. |
| Use White's file mapping for Black | `board-geometry.contract.test.ts`, generated render/hit agreement | The property failed at width 8, scale 0.125, square 0, Black. |
| Keep a drag after disabling input | `board-authority.feature`, disabled held piece | The piece remained held after input was disabled. |
| Await native completion under reduced motion | `accessibility.contract.test.ts`, preference change | One native animation remained instead of zero. |
| Restyle every piece on input | `chess-board-input.test.tsx`, move placement budget | 32 pieces were restyled instead of one. |
| Block input with a finite calculation | `performance.contract.test.ts`, capture response | Input scripting took 120ms against the existing 50ms ceiling. |
| Freeze final placement in old pixel coordinates | `visual.contract.test.ts`, resized capture | The attacker ended at 160.21875 instead of the resized center 280.03125. |
| Let an abandoned completion write its destination | `piece-animator.test.ts`, cancelled completion | The older destination replaced the newer destination. |
| Import an internal renderer from a consumer | `@libs/chess` `check:board-contract` | The gate reported an undocumented `chess-board-pieces` import. |
| Omit the example board's sound choice | `@libs/chess` `check:board-contract` | The gate required an explicit app preference or silence. |
| Always enable the example board's sound | `@libs/chess` `check:board-contract` | A constant-on choice failed the same policy check. |
| Always enable the public sound helper | `@libs/chess` `check:board-contract` | The gate rejected the helper's constant-on accessor. |
| Shift capture hints away from their target | `marking-geometry.contract.test.ts`, occupied capture rings | The ring differed by 20 pixels at half scale against a 0.015625-pixel tolerance. |
| Put file labels on the opposite edge | `marking-geometry.contract.test.ts`, viewer-edge labels | The label escaped its expected cell by 75.161 pixels and failed the edge-half check. |

Native raster references mount fresh model and piece nodes. Frame-work recording
counts both delivered observer records and records awaiting delivery. Literal
regressions for both evidence defects are part of normal verification.
