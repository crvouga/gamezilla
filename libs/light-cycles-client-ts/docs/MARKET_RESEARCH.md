# Reading a Light Cycles board under pressure

Three released games ask the player to steer a moving rider through an arena that other players progressively fill. Simple Light Cycles shows the whole arena from above. Retrocycles shows the height of each wall. Curve Fever Pro shows a ship turning through curves. Each gives a different answer to the same question: before the next turn, what can I tell from the board?

## Simple Light Cycles · Kelsam

![Overhead playfield with thick yellow, green, cyan and blue paths. Green particles spread where the green line meets a gray corner.](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/655030/ss_ce8619f12a9303197f02287bdd81801fde71533b.1920x1080.jpg)

*Kelsam's gameplay screenshot, accessed November 25, 2026. The blue path doubles back along the bottom edge. Two parallel segments leave a narrow black passage between them.* [Publisher's Steam gallery and description](https://store.steampowered.com/app/655030/)

The frame shows right-angle bends, flat-ended paths, and a thin gray perimeter against black. Each color can be followed through several turns. An endpoint has the same width and color as the rest of its path. With both ends in view, the line alone gives little indication of which end is moving.

Kelsam describes local players controlling ever-growing lines to trap or outlast opponents, with configurable game modes. Another gallery image shows settings for self-collision and border wrapping. The green burst marks a place worth looking at, but the still cannot establish who crashed, whether the round ended, or how long the burst lasted. [Publisher's settings screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/655030/ss_64e96974fae6d83e6f7bab98ea114b769dac2d0d.1920x1080.jpg)

## Retrocycles · Manuel Moos

![Oblique view of translucent red and violet trail walls over a dark floor grid. Two small vehicles are close together near the center.](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1306180/ss_843c90ff49a5624603fb3ddc09aa4f52e73a3a73.1920x1080.jpg)

*Manuel Moos's gameplay screenshot, accessed November 25, 2026. The red wall folds back around a pocket of floor in the foreground. The violet wall ends beside the vehicles in the center.* [Publisher's Steam gallery and description](https://store.steampowered.com/app/1306180/)

The vertical faces make the trails look like barriers. Their upper edges trace corners even where the floor is hard to see. The vehicles mark the active ends, although their small silhouettes are difficult to resolve where the two colors meet. Perspective also makes a distant passage appear narrower than a similarly sized passage in the foreground.

The publisher describes continuous movement, sudden right-angle turns, deadly trails, and a last-survivor victory in the basic mode. Other modes change the objective. The still shows proximity to a wall but supplies no clear elimination or winner signal. [Publisher's rules](https://store.steampowered.com/app/1306180/)

## Curve Fever Pro · Jos Games

![Overhead ships and curved trails on a dark blue field. A white-edged blue trail breaks to the left of the ship marked 70.](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1133700/ss_725d6b80b2bf039d47928c6997a5f14a3be87a5e.1920x1080.jpg)

*Jos Games' gameplay screenshot, accessed November 25, 2026. Near the center, a small pointed ship faces right at the end of the blue curve. Above it, two orange tracks and several symbols sit close together.* [Publisher's Steam gallery and description](https://store.steampowered.com/app/1133700/)

The nose gives a heading even when only a short piece of trail is visible. The blue track has a bright center stripe, while the gray track at left has a segmented texture. A reader can trace these paths using more than hue. Scores and power symbols near the ships compete for space at a close encounter.

Jos Games describes left and right steering, gaps riders can pass through, and crashes against walls or trails. Powers can also transfer points. The green and orange score changes in this frame therefore cannot identify an elimination by themselves. Curved steering and traversable gaps make this a reference for reading a rider's nose, with different rules for judging an open lane. [Publisher's rules](https://store.steampowered.com/app/1133700/)

## The same four decisions across the boards

| Player decision | Simple Light Cycles | Retrocycles | Curve Fever Pro |
| --- | --- | --- | --- |
| Which way am I going after a turn? | The elbow records the turn. The flat tip gives little help picking the moving end. | A bike marks the active end. The last straight wall segment gives its axis. | The pointed ship gives a heading even along a shallow curve. |
| Whose trail am I following? | A solid color persists through every visible bend. | Red and violet faces separate the two routes, including long parallel runs. | Stripe, texture and hue help connect the ship to the last stretch of trail. |
| Will I fit through the opening? | Black floor between square-edged lines shows the passage at a uniform scale. | Wall height signals danger. Perspective complicates judging clearance farther away. | Breaks in curved trails can be passages, so continuity carries gameplay meaning. |
| Who went out, and where? | The burst gives a location. Its cause and rider status need another cue. | Neither the vehicles' proximity nor the wall colors establish a crash in this frame. | Points and power effects have several causes. They cannot serve as a crash record. |

These are readings of the pictured states. A single frame gives no measurement of input delay, when an accepted turn becomes visible, or how players perform with these cues.

## Board-only choices for Light Cycles

- **Show the heading at the active end.** Put a high-contrast nose inside the rider's current cell. Rotate it to the committed heading when the rider turns. Compare the last frame before a legal turn with the first after it, then repeat with a rejected reversal. The nose should agree with the actual direction in both cases. [Riding scenarios](../../../specs/light-cycles/light-cycles-riding.feature)
- **Carry ownership through a bend.** Pair each rider's head mark with a corresponding interior mark on its trail. Keep the occupied shape continuous beneath the marks. In a four-rider position, follow a trail through two corners with hue removed. The marks should identify its owner without suggesting a break that another rider can cross.
- **Make a one-cell passage read as one cell.** Use the same top-down scale for the edge, rider and trail. Contain outlines and glow inside the occupied footprint. Exercise a route with two parallel trails one cell apart and a rider alongside the outer edge. The open lane should remain visible across its entire length.
- **Leave a crash mark where the rider stopped.** Replace that rider's nose with a distinct stationary mark in its last occupied cell and retain its hazardous trail. For a simultaneous crash, mark each stopped rider. For a Trio crash with two survivors, keep both survivors' headings visible while they continue. Check the settled frame with motion disabled so the result remains readable after any impact effect. [Crash scenarios](../../../specs/light-cycles/light-cycles-crashes.feature) · [Round scenarios](../../../specs/light-cycles/light-cycles-rounds.feature)

## Decisions and verification · November 25, 2026

| Player task | Decision for this board | Evidence |
| --- | --- | --- |
| Distinguish an accepted turn from current travel | The chassis points in the committed direction. A detached chevron marks a queued turn. With reduced motion the cue appears immediately. | The hosted Duel drag scenario checks the queued direction. Round 2 adds an assertion on the painted chevron in both motion preferences. |
| Follow a rider through a crowded area | Retain four trail patterns and upright rider letters. A solo player starts following their own cycle. Spectators and two people sharing the board start in the full arena and can select a rider by name. Free inspection remains available to spectators. | The board test covers two fingers becoming one, panning, taking a rider, following that cycle, and requiring a fresh swipe to steer. Hosted phone and desktop scenarios compare the world coordinate under the gesture anchor. |
| Locate an eliminated rider | The live chassis becomes a broken disc with its letter. A crossed badge marks the crash while the trail remains visible. | The Round 1 Duel, Trio and Quad captures show the board at its original cell scale. The Round 2 sustained scenarios exercise the same production drawing under normal and throttled CPU. |

Round 1 board captures (PR #578, comment 7158913287) · Round 2 decisions and hosted verification history (PR #578)

### Following a rider · November 25, 2026

Simple Light Cycles’ overhead view preserves the width of a corridor. Retrocycles keeps vehicles and nearby walls prominent but changes their apparent size with distance. Our follow view keeps the overhead orientation and magnifies by 1.65×, showing roughly 26 by 19 cells of the 40 by 28 arena including exterior margin. A two-cell band around the centre allows a quick change of direction without immediately shifting the camera. At the perimeter the view stops panning. The picker names the rider, marks a local rider as yours and a crashed rider as out. Switching or starting a new round cuts straight to the target. A crash holds the last position until that rider restarts. Reduced motion removes camera interpolation.

The production-board journeys exercise phone swipes and desktop keys during follow, spectator selection, rapid turns, switching targets, a crash, respawn and return to the full arena. The full-arena option preserves an overview for players who need to see a distant opponent. Round evidence and design steering (PR #578)

### Open questions

Can players identify all four owners from trail patterns alone in a dense monochrome position? How quickly do they distinguish a queued turn from the committed nose at phone size? Browser state and frame measurements can show a cue was painted and preserved. Answering either player-recognition question requires evidence of task performance.
