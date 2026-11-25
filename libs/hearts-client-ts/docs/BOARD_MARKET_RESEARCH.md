# Reading a Hearts trick on a phone

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

## Change for our board

The [current board message](../src/hearts-table-view.tsx) already names the taker and winning card. Each seat also reports deal points. Extend that same visible and spoken message with the penalty value of the four captured cards. For the hand in Figure 5 it could read “Isabella took the trick with the jack of hearts and leads. This trick added 4 deal points.” Keep the four cards visible so a player can check the count. This uses the existing message area in portrait and avoids covering a rank as the central heart does in Figure 5.

An automated example can distinguish the three quantities. Give the taker an existing match score and nonzero points earlier in the deal. After the four-heart trick, the result should say 4 deal points for this trick, the seat should show its updated deal total, and the match score should retain its value until the deal is scored. Also cover a zero-point trick and a trick containing the queen of spades. This is a proposed improvement. The screenshots establish how competitors present information, without establishing usability outcomes for our players.
