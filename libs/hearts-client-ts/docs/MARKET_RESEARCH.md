# Hearts board market research

Show the penalty points in the completed-trick message beside the player's name and winning card. A player who sees “North took the trick with the jack of hearts” can identify the winner but still has to count the hearts to understand what North took. Hearts Card Classic shows that count on the trick. Coppercod's review shows why the four cards and their seats are worth preserving when displaying the result.

## Inspected screenshots

These are publisher-supplied phone images, linked from their original hosts. Coppercod's images are 311 × 552 portrait promotions with gameplay below the headline. Games By Post's images are 405 × 228 landscape gameplay captures from its iPhone listing. The different orientations limit comparisons of available vertical space. Screen dimensions here describe the downloaded images. Neither tap-target dimensions nor behavior over time can be measured from them.

### Hearts by Coppercod

![Three cards on the table, with four gray spades and two bright hearts in the bottom hand](https://coppercod.games/game-assets/hearts/1.jpg)

*Figure 1. A club sits above the center and hearts sit to either side. The empty bottom position lines up with the local hand. The hand retains the ranks and suits of the shaded cards.* [Coppercod product page and rules, accessed 2026-11-25](https://coppercod.games/game/hearts/)

![Previous Tricks panel showing four seat-relative cards, navigation arrows and four named scores](https://coppercod.games/game-assets/hearts/2.jpg)

*Figure 2. “Previous Tricks (10 of 13)” puts one trick above a row labeled You, West, North and East. A border singles out the seven of spades on the right. The image alone does not explain the border.* [Coppercod product gallery, accessed 2026-11-25](https://coppercod.games/game/hearts/)

### Hearts Card Classic by Games By Post LLC

![Select 3 cards to pass left above three empty card outlines and a thirteen-card hand](https://is1-ssl.mzstatic.com/image/thumb/Purple114/v4/fc/be/db/fcbedb84-9f64-e8eb-6e45-14a12bd6864a/pr_source.png/406x228bb.png)

*Figure 3. The pass prompt gives the count and direction above three empty positions. The local hand occupies one overlapping row.* [Publisher's iPhone listing, accessed 2026-11-25](https://apps.apple.com/us/app/hearts-card-classic/id1365096468)

![Two diamonds on the table and three bright diamonds among the player's shaded cards](https://is1-ssl.mzstatic.com/image/thumb/Purple124/v4/89/ec/ad/89ecadf8-f011-308d-8f4d-9b30e0f9f225/pr_source.png/406x228bb.png)

*Figure 4. With diamonds on the table, the four, seven and nine of diamonds remain bright. “Drop a card here” appears immediately below the trick.* [Publisher's iPhone listing, accessed 2026-11-25](https://apps.apple.com/us/app/hearts-card-classic/id1365096468)

![Four hearts on the table with a central plus-four heart and scores beside the players](https://is1-ssl.mzstatic.com/image/thumb/Purple124/v4/4d/72/a0/4d72a0fb-3230-6478-f5d2-67b061a3ce0f/pr_source.png/406x228bb.png)

*Figure 5. A heart marked “+4” covers part of the four-card trick. Isabella's jack at right is the highest heart. At left, Charlotte has 13 beside her seat and 1 in the upper score list. The two numbers have no visible period labels.* [Publisher's iPhone listing, accessed 2026-11-25](https://apps.apple.com/us/app/hearts-card-classic/id1365096468)

## Four decisions at phone scale

| Player's question | Coppercod Hearts | Hearts Card Classic |
| --- | --- | --- |
| Which three am I passing, and where? | The rules document left, right, across, then no pass. They describe changing selections and using a pass button. Neither inspected image shows its placement or the selection count. | Figure 3 makes both quantity and direction readable before selection. The empty slots are visible evidence. How a player revises a full selection is unobserved. |
| Which card can I play? | Figure 1 differentiates cards by brightness. A legality cue is a plausible interpretation, but the led suit is unmarked in this still. The rules document following suit, tapping to select and tapping again to play, with a single-tap option. | In Figure 4 the bright subset matches the suit on the table, so a player can find the three candidates without scanning every rank. The drop instruction documents a gesture. Handling of a refused card is unobserved. |
| Who took the trick? | Figure 2 preserves seat positions when reviewing an earlier trick. Its numbered review and arrows let a reader distinguish past play from the live table behind it. No winner is named in the image. | In Figure 5 the jack sits next to Isabella. Ownership can be inferred from its position and rank. A player looking only at the central heart sees the cost but no name. |
| What did this trick cost? | The rules call the numbers in front of each hand game scores. Figure 2 labels players and displays their totals, but gives no explicit point change for the reviewed trick. | Figure 5 gives the trick's four points directly, even at landscape phone width. Distinguishing the other numbers requires more context than this frame supplies. |

## Decisions and verification · 2026-11-25

The board keeps each played card beside its owner. The winning seat shows the points captured in this trick alongside its deal and match totals. The board announces those points with the taker and winning card. This preserves Coppercod’s seat-relative arrangement and answers the question addressed by Hearts Card Classic’s central point marker. A queen-bearing trick and a zero-point trick have automated examples. The queen story shows all four cards and distinguishes the 13 points taken from West’s match score of 20. [Board presentation](../src/hearts-table-view.tsx) · [Queen-bearing example](../tests/deal-points-label.test.tsx)

The hand retains separate, non-overlapping targets. A player can tap a card, activate it by keyboard, or drag it onto the felt, as suggested by Hearts Card Classic’s drop instruction. Pinch and pan apply to the felt so the hand stays at a fixed size during inspection. The hosted gesture journeys exercise interrupted pickups and the same accepted move on phone and desktop. The automated passing comparison uses the same three selected cards at both viewport sizes. [Passing evidence](https://github.com/crvouga/gamezilla/pull/580#issuecomment-7159551935) · [Gesture journeys](../../../pkgs/ui-root-harness-ts/tests/storybook/hearts-overhaul/gestures/integration.checks.ts) · [Current verification and clips](https://github.com/crvouga/gamezilla/pull/580)

## Outstanding questions

Can a first-time player discover drag-to-felt from the pickup and drop cues? Do players distinguish points from this trick from points accumulated this deal at a glance? The screenshots and automated journeys establish the information and interactions available. Answering those questions requires evidence from people playing.
