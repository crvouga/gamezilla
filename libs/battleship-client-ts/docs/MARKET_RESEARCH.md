# Battleship board market research

Three publisher storefronts show different ways to read a fleet, aim and recognize a shot result. The evidence below comes from the pictured game states. A visible input instruction establishes the advertised gesture. A still image alone cannot establish timing, keyboard or touch behavior, or what happens after a control is activated.

## Hasbro’s BATTLESHIP · Marmalade Game Studio Ltd

![Deploy Fleet screen with occupied cells outlined and movement and rotation instructions beside the grid][hasbro-setup]

*Deployment. A vertical ship fills A3 and B3. The grid keeps its cell edges visible around the hull. “Drag to move” and “Click to rotate” sit beside the fleet.* [Official Steam gallery, accessed 2026-11-25](https://store.steampowered.com/app/893050/)

![Torpedo targeting screen with row F bracketed, a compact friendly board and check and cross buttons][hasbro-aim]

*Commanders mode. Blue brackets span row F. The torpedo description and check and cross controls sit below the board.* [Official Steam gallery, accessed 2026-11-25](https://store.steampowered.com/app/893050/)

- **Placement and orientation.** The numbered columns, lettered rows and shaded footprints make a ship’s extent countable, even where a ship occupies an irregular shape. The mouse instructions are explicit. They provide no equivalent cue for touch rotation.
- **Targeting and correcting aim.** The bracket shows the entire proposed line of fire, including its direction. The check and cross suggest accepting or discarding that aim. Whether a player can move it directly, or must cancel first, is unresolved. This image shows a special weapon, so its aiming sequence cannot establish the classic single-shot sequence.
- **Hits, misses and sunk ships.** Red and white pegs preserve a visible shot history. They share a circular silhouette, making color important to interpreting them. A revealed hull and a matching fleet icon provide a second level of detail. The frame has no legend or sinking sequence to confirm when that hull appears.

## Battleship Blitz · Toonik Games

![Overhead wooden fleet with horizontal and vertical ships, crosses beside hulls, and Auto placement and Undo placement controls][blitz-setup]

*Deployment. Crosses trace cells surrounding ships, and the upper-left controls name two ways to revise the layout.* [Official Steam gallery, accessed 2026-11-25](https://store.steampowered.com/app/3918800/)

![Overhead battle grid showing a red reticle beside wreckage, small round marks in cells and crossed-out fleet silhouettes][blitz-aim]

*Battle. A red reticle, scattered pieces and small round marks occupy different cells. Two silhouettes are crossed out in the lower-right fleet display.* [Official Steam gallery, accessed 2026-11-25](https://store.steampowered.com/app/3918800/)

- **Placement and orientation.** The long wooden hulls make horizontal and vertical headings recognizable. Crosses appear around them, suggesting excluded positions. Neither a rotation gesture nor the precise spacing rule is pictured. Spars and sails extend beyond some hulls, making the occupied footprint harder to count.
- **Targeting and correcting aim.** The reticle is compact enough to identify one cell while leaving nearby marks visible. The grid lines are faint against the water, and there are no visible axis labels to help recover a coordinate. The still cannot distinguish a movable aim from a marker on the last shot. The setup Undo control supplies no evidence of a battle undo.
- **Hits, misses and sunk ships.** Wreckage and crossed-out silhouettes suggest the loss of a whole ship. The small round marks are visually distinct from wreckage, but their meaning and the distinction between a hit and a miss are unclear without a legend. The fleet display communicates loss more clearly than the scattered pieces communicate the ship’s original footprint.

## Sea Battle 2 · BYRIL OOO

![Two graph-paper boards with player names, lettered rows, ships, hatching and an aircraft attack over the right board][sea-battle]

*Battle on iPad. The publisher’s promotional caption covers the bottom rows. The visible play area still shows both players’ grids and the attack effect.* [Official App Store gallery, accessed 2026-11-25](https://apps.apple.com/us/app/sea-battle-2/id913173849)

- **Placement and orientation.** On the left grid, one hull runs across row D and another down rows B through E. The square paper and hull ends make length and direction readable. Deployment and its controls are outside the frame.
- **Targeting and correcting aim.** The two boards have player names, distinct borders and matching row labels. A player can compare the same row across both waters. Equal board sizes consume substantial width, and the aircraft overlaps several candidate cells. The green arrow points right, but neither a target selection nor a correction gesture can be identified from it.
- **Hits, misses and sunk ships.** Hatching, segmented hulls, red corners and impact drawings provide several cues beyond color. With no visible key, hatching could denote more than one kind of unavailable water. Smoke obscures the underlying cells. A persistent hit, miss or sunk state cannot be assigned reliably from this attack frame.

## Decisions for our board

| Board task | Design choice | Observable check |
| --- | --- | --- |
| Place and rotate a ship | Outline the exact occupied cells. Keep a labeled rotate action reachable beside the selected ship and show its resulting footprint before placement. | Rotate a ship near an edge. A player can identify the proposed cells, see any conflict and correct it while keeping the ship selected. |
| Pick a coordinate and change it | Put the coordinate in the aim feedback. Give the pending cell a distinctive outline and keep Confirm and Cancel available. | Select D4, then D5. Only D5 shows pending aim. Cancel clears the outline. Neither cell enters shot history until a shot is confirmed. |
| Interpret a shot or sinking | Use distinct hit and miss shapes. On sinking, join the affected cells with a hull outline while preserving the evidence in each cell. Name the result and coordinate in board feedback. | In a board containing all three outcomes, each remains identifiable in grayscale and after any impact effect ends. The full sunk footprint can be counted. |
| Find the water that accepts the next action | Name both waters and give the active grid enough space for its axes and target cells. Keep the other fleet visible as context when space permits. | On a narrow board, pending aim and its coordinate remain visible together. A player can tell whose water is targeted before confirming. |

[hasbro-setup]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/893050/ss_d5fa170dfbac4d172d43f56287dd71cce9001514.1920x1080.jpg?t=1752167994
[hasbro-aim]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/893050/ss_221380692b015a434a5b75ba4ffd860ac1116df0.1920x1080.jpg?t=1752167994
[blitz-setup]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3918800/94cf8b7824d728dd961f1a3be42803b46e3cee6b/ss_94cf8b7824d728dd961f1a3be42803b46e3cee6b.1920x1080.jpg?t=1794072565
[blitz-aim]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3918800/6f5957ae14aadf5af61d487200960d503f3e2349/ss_6f5957ae14aadf5af61d487200960d503f3e2349.1920x1080.jpg?t=1794072565
[sea-battle]: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource116/v4/ce/f0/9f/cef09f30-7c3d-5de4-5378-450e26d4d54b/dd91f02f-f09c-4103-99ca-22663ac18633_2.jpg/1024x768bb.jpg

## Decisions and verification · 2026-11-25

- **Reposition a ship.** Preserve the hull segment a person picked up and outline the proposed footprint. A second finger interrupts placement and starts inspection. The hosted gesture check picks up the Carrier at C1, previews it at C2, verifies the bow at A2 and interrupts a second drag. [Gesture checks](../../../pkgs/ui-root-harness-ts/tests/storybook/battleship/gestures/checks.ts)
- **Inspect without firing.** The region map stays at fit on phones to preserve whole-field context. Its working grid and the desktop firing field support pinch, pan and return to fit. A selected cell keeps its reticle until corrected, cancelled or fired. The hosted aim-correction and sinking comparisons show the marks on the playable surface. [Round 1](https://github.com/crvouga/gamezilla/pull/579#issuecomment-7158890900) · [Round 2](https://github.com/crvouga/gamezilla/pull/579#issuecomment-7159003670)
- **Read outcomes after motion ends.** A miss remains a ring, a hit a cross, and the wreck retains the ends and sides of its public footprint. Pickup and impact motion are brief. With reduced motion, the same cell outlines and glyphs carry the information. [Cell rendering](../src/battleship-grid-cells.tsx) · [Motion rules](../../../pkgs/battleship-board-client-ts/src/navigable-grid/surface.module.css)

## Open questions

The publisher stills leave accidental-shot rates, correction time and rotation discoverability unresolved. The hosted checks establish our board's response to scripted input. Whether people discover the two-finger inspection gesture without prompting, or distinguish the marks faster than on another board, needs comparative observation.
