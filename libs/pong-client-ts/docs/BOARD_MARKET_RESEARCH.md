# Reading a Pong board during and between rallies

Three publishers' gameplay screenshots show different ways to answer two questions in the middle of a point. Where is the ball headed? Which paddle can I move? They provide less evidence about a third question: when can I play again? The captions describe visible details. The comparison interprets those details, and the final section proposes changes for this board.

## Strange Pong

[![Black court with two white paddles, a square ball with a tapered trail, and a gray 5–5 score.][strange-thumb]][strange-full]

*Heartales, Strange Pong. The ball is above and right of center. Its short white trail points back toward the dashed divider. Both paddles have the same shape and color. The score sits above each half. Accessed November 25, 2026.* [Publisher's Steam listing](https://store.steampowered.com/app/2689460/)

## Skew Pong

[![Tilted court with green and magenta paddles and a green ball trailing a curve toward the right edge.][skew-thumb]][skew-full]

*Axel Born, Skew Pong. The ball is near the magenta paddle. A curved trail records its approach. Each paddle shares a color with its end line and score. In a separate setup image, the board labels Up and Down beside each player's keys. Accessed November 25, 2026.* [Publisher's Steam listing](https://store.steampowered.com/app/1816690/) · [Setup image](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1816690/ss_fb3aaedee018f57227f622819df2b5346c1d1397.600x338.jpg?t=1794623700)

## PONG Quest

[![Four colored paddle characters on a dark court, with an orange ball near the top and ball inventory panels outside the sidelines.][quest-thumb]][quest-full]

*Atari, PONG Quest. An orange square sits near the upper boundary with small orange and white particles behind it. Each of the four paddle characters has a distinct color. Health bars sit above the court, and item panels flank it. Accessed November 25, 2026.* [Publisher's Steam listing](https://store.steampowered.com/app/1177030/)

## What a player can read

| Board task | What helps, and where a player may struggle |
| --- | --- |
| Track the ball through a rally | In the Strange Pong frame, the bright head gives the eye one point to follow. The dim divider stays distinct even where the ball crosses it. Skew Pong's curve conveys a bend that a single ball position cannot show, but its bright rails and perimeter squares also draw the eye. In PONG Quest, the particles suggest recent travel. Close to the upper wall, several particles resemble the small square a player is looking for. |
| Identify and steer a paddle | Strange Pong makes both contact edges easy to locate, but the frame alone gives a newcomer no cue about which side they steer. Skew Pong pairs each score with its paddle by color and teaches direction on the board before the match. Once the court tilts, screen-up and movement along the end line diverge. PONG Quest's costumes help distinguish four paddles, but identifying a character still requires knowing who controls it. |
| Read an interruption and return to play | Strange Pong's score positions give a player somewhere predictable to look after a point. Skew Pong's setup shows a way to teach controls before play, though it does not establish how play resumes. PONG Quest leaves room outside the court for status, but an item panel or health bar alone cannot tell a returning player when to move. None of these rally images shows the transition to the next serve. |

## Proposals for this board

- **Keep the ball readable at contact.** Give the ball a solid, high-contrast head against both the court and its markings. Keep the divider and boundary quieter than the ball. If the board uses a trail, taper it behind the head and clear it before each serve so the previous point leaves no false path.
- **Put ownership beside the paddle.** Use a short side label beside each end before the serve, with a steering hint for each controllable paddle. In bot play, label the bot's end. For a spectator, identify the sides and omit steering hints. Keep labels outside the paddle's full travel, including its upper and lower limits. [Local play](../../../specs/pong/pong-local-play.feature) · [Shared control](../../../specs/pong/pong-shared-control.feature)
- **Make the next serve predictable.** Leave the score over the same two halves after a point. Show the countdown near the serve position and clear it when the ball enters play. On the winning point, use that space for the winner and final score. [Scoring](../../../specs/pong/pong-scoring.feature)
- **Explain a connection interruption at the court.** When a shared player disconnects, retain the visible paddle positions and say whose connection the players are waiting for. Clear the notice when control returns. A disconnected spectator needs a last-seen indication on their own board while play continues for the players. [Shared control](../../../specs/pong/pong-shared-control.feature) · [Local spectators](../../../specs/pong/pong-local-watch.feature)

These are publisher-selected stills. They establish layout and visible cues. They cannot establish tracking accuracy at speed, input latency, touch reach, or the sequence after a point or disconnection. The interruption proposals follow this game's scoring and control rules. Their usability remains unmeasured.

[strange-thumb]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2689460/ss_42f23d08e5af85b187270951978a18953da1c633.600x338.jpg
[strange-full]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2689460/ss_42f23d08e5af85b187270951978a18953da1c633.1920x1080.jpg
[skew-thumb]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1816690/ss_2ddeaf31d7158f979cc9ec82349061ce45c99e47.600x338.jpg
[skew-full]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1816690/ss_2ddeaf31d7158f979cc9ec82349061ce45c99e47.1920x1080.jpg
[quest-thumb]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1177030/ss_3512ba3e03ab1cefe23cd1554b34297b3d70085b.600x338.jpg
[quest-full]: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1177030/ss_3512ba3e03ab1cefe23cd1554b34297b3d70085b.1920x1080.jpg
