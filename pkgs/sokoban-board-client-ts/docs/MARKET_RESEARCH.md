# Reading a Sokoban board one push at a time

A push involves three squares in a line. The worker needs somewhere to stand behind the load, the load occupies the middle square, and the square beyond it must be free. These three publisher images show different ways to read that line and identify a delivery. The captions describe visible evidence. The accompanying text attributes controls and rules to their publishers.

## Sokoban for Windows · Björn Källmark

![Classic skin with a worker, silver and gold balls, red goals and blue walls](https://www.sourcecode.se/sokoban/images/Classic.png)

*Björn Källmark’s Classic skin. Across the upper-left passage, the white figure, silver ball and exposed red square already line up for a push to the right. Farther along the same row, red corners remain visible around a gold ball. Accessed November 25, 2026.* [Publisher’s skin gallery](https://www.sourcecode.se/sokoban/skins.php)

**Reading the board.** The continuous beveled blue wall traces the edge of the flat cream floor. The worker’s feet and dark cap distinguish the figure from the round loads. The example contains both delivery states at once. A ball covers the middle of the goal, yet its round outline leaves the square target visible underneath.

**Documented play.** The publisher’s online demo instructs players to push one ball at a time with the arrow keys or click a ball adjacent to the worker. It offers Undo alongside Restart. The gallery image shows a position only. [Publisher’s demo and instructions](https://www.sourcecode.se/sokoban/)

## JSoko · Matthias Meger

![JSoko Original level 26 with striped flooring, a forklift and a cluster of marked bays](https://jsokoapplet.sourceforge.io/media/images/screenshotjsoko_main_view-large.png)

*JSoko’s main game view, Original level 26 after 16 pushes. In the right-hand room, two wooden crates carry small yellow marks. The open bays above and below them carry centered crosses. Accessed November 25, 2026.* [Official screenshot gallery](https://jsokoapplet.sourceforge.io/screenshots.html)

**Reading the board.** Striped flooring runs up to thick, solid walls, including a divider that blocks a straight approach from the left. The yellow vehicle beside the two marked crates is the worker. Each open bay has both an outline and a cross. A delivered crate keeps its wooden face and gains a corner mark, so its identity survives delivery. The two adjacent crates illustrate why seeing an open bay alone cannot establish a legal push.

**Documented play.** Selecting a crate displays small translucent crates at destinations it can reach. JSoko can omit destinations that would deadlock the level. Backspace or Delete undoes the last move and Insert redoes it. The published frame does not show that sequence. [Publisher’s play guide](https://jsokoapplet.sourceforge.io/jsoko/how-to-play.html)

## Sokoban Land DX · lightUP

![A character stands between two side lanes with crates and a central lane with two dark target squares](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/670850/ss_dbdbd2a7ef04679cba63e13c46c36f1f8a885713.600x338.jpg)

*lightUP’s gameplay screenshot. Two cross-braced boxes sit in side lanes. The character stands directly above two empty dark sockets in the center. Accessed November 25, 2026.* [Publisher’s Steam listing and screenshot gallery](https://store.steampowered.com/app/670850/Sokoban_Land_DX/)

**Reading the board.** Light grass traces the passages through darker ground and flowering hedges. The worker’s black hair, face and blue clothes form a distinct silhouette. The square recesses differ from the boxes in both size and relief. Each box starts off the targets’ centerline, so planning the approach requires reading the lanes between them. Both sockets are empty in this frame.

**Documented play.** lightUP says placing the boxes opens the gate to the next level. Each player can undo their last move, including during local co-op. The screenshot establishes the appearance of an empty socket. The listing establishes the completion and undo rules. [Publisher’s game description](https://store.steampowered.com/app/670850/Sokoban_Land_DX/)

## Board-local opportunities

| Player task | Proposed treatment | Observable check |
| --- | --- | --- |
| Trace the approach behind a crate | Give walls a continuous, raised boundary and keep the walking surface quiet. Carry the floor treatment through open bays. | In a one-cell passage, the standing square, crate and destination can each be located against the wall edge. |
| Find the worker | Reserve one silhouette for the worker, with a distinct head and body even at the smallest supported tile size. | A worker standing on a bay is distinguishable from both a loose crate and a delivered crate in grayscale. |
| Push into an open bay | Give an empty bay a hollow center and corner marks extending beyond the crate face. Keep the crate silhouette consistent during the push. | From a position like the Windows example, a single right push replaces the empty center with the crate while the bay corners stay visible. |
| Recognize delivery and undo | Add a persistent shape to the delivered crate. Derive the mark and bay appearance from occupancy after every move. | Undoing that push restores the open bay, loose crate and worker to their prior squares, including when animation is disabled. |

These are design proposals. The screenshots demonstrate existing visual cues, and the publisher descriptions establish the supported actions. Neither source measures recognition speed, error rates or an advantage for the proposed board.

## Decisions and verification · November 25, 2026

The playable warehouse keeps its light floor and dark wall blocks. A hard hat identifies the worker. Open bays have a hollow center and four corner marks. Like JSoko’s marked wooden cargo, a delivered crate keeps the same timber brace. A check stamp records the delivery. The board derives both from the piece’s current square, so undo restores the loose crate.

A swipe at fit requests one step on release. Pinch, magnified drag and trackpad pan inspect the same puzzle without submitting steps. A tap on an adjacent square uses the displayed coordinates, including at magnification. Holding one contact magnifies or restores fit. While magnified, the Fit board button restores the whole board and returns keyboard focus to play. Keyboard players can zoom, pan and fit while the direction keys still play. Crates glide for 120 ms with motion enabled. Reduced motion places them immediately.

The production two-crate Storybook journey pushes a crate onto a bay, beyond it, then back onto it with Undo. The phone and desktop warehouse checks cover an occupied bay, transformed tap or swipe, interrupted navigation, crate motion and reduced motion. The first illustrated board’s hosted push-and-undo p95 was 12.6 ms on the 390 px, 4× CPU profile and 12.4 ms on desktop. Each condition comprised 20 alternating inputs with no observed long tasks. The measurement ends at the next animation frame after the move count changes. Round 1 board recordings and timing comparison (PR #583, comment 7159686317). At board commit `7a275f86cc`, the hosted phone and desktop journeys passed pinch or trackpad zoom, bounded pan, return to fit, delivery, undo, and normal and reduced crate motion. Push-and-undo p95 was 14.0 ms on phone and 14.8 ms on desktop, with zero observed long tasks. Panning at normal CPU speed took 33.1 ms and 29.7 ms p95 respectively across 20 inputs per viewport. The 320 px maximum-board walk passed at 14.8 ms p95 on the 4× CPU profile. Round 2 screenshots, recordings and measurements (PR #583, comment 7161291922)

**Open question.** Does a first-time phone player notice the goal behind the worker at maximum board density? The automated captures show the marking and placement. A recognition-rate comparison would require observing players performing that task.
