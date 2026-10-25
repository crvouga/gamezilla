# Gherkin source ownership

The compiler retains every authoritative `.feature` file as a complete source card and derives exact business example cards alongside it. Rule headings, explanatory prose and scenario descriptions remain available in the full document. Backgrounds are included in the examples, outline rows become concrete examples, and tables and detailed outcomes are retained. The current catalog contains 231 complete feature documents and 1,636 expanded examples from those files.

Ownership belongs to capability regions inside the one product machine. The
compiler collects their source references, removes line fragments, and
attaches matching examples to the single product chart. A source may inform
several regions. Individual state descriptions and line references explain
particular outcomes; an arbitrary leaf state is never treated as the owner of
every rule in a feature.

| Source context | Product regions |
| --- | --- |
| [Auth](../../specs/auth/) | Signing in |
| [Billing](../../specs/billing/) | Billing |
| [Chess](../../specs/chess/) | Game choices, puzzles, feed, links, history, import, Custom Games, multiplayer |
| [Chessboard](../../specs/chess-board/) | Independent chessboard contract |
| [Database maintenance](../../specs/db-indexes/) | Maintenance contract |
| [Developer tools](../../specs/developer-tools/) | Test worlds, notebooks, release evidence, inspection scope |
| [Feedback](../../specs/feedback/) | Feedback |
| [Friends](../../specs/friends/) | Friendships, inbox |
| [Games](../../specs/games/) | Game choices, Custom Games, multiplayer, finding a Pong opponent without a clock and matched Pong without turns |
| [Journeys](../../specs/journeys/) | Whole-product root, Pong, Sokoban and puzzle content |
| [Matchmaking](../../specs/matchmaking/) | Independent matchmaking contract |
| [Numberlink](../../specs/numberlink/) | Numberlink |
| [Pong](../../specs/pong/) | Pong |
| [Profile](../../specs/profile/) | Identity, profile and devices, signing in, sign-in methods, privacy |
| [Puzzles](../../specs/puzzles/) | Puzzle content: drafts, playtests, editions, packs, attempts and pack progress |
| [Room](../../specs/room/) | Independent room contract |
| [Runtime](../../specs/runtime/) | App navigation, settings, opening and updates, environment, inspection scope |
| [Sokoban](../../specs/sokoban/) | Sokoban |
| [Spaces](../../specs/spaces/) | Spaces |
| [Sync engine](../../specs/sync-engine/) | Independent notes contract, related inspection scope |
| [Synthetic Population](../../specs/synthetic-population/) | Test worlds, Pong |

This table locates source families; the current exact examples and their
source addresses are in `.cache/product-statechart/contracts.json`, produced
by `bun atlas:lint`. The enriched machine in
`.cache/product-statechart/specs/product.machine.json` records their state
ownership and can be read in the viewer's state details or search. A newly
added feature without an owner fails compilation.

Source ownership is traceability. It does not assert that every scenario has a separate graph edge or that its application acceptance check has run. The authoritative coverage rules remain [specs/README.md](../../specs/README.md); [EXECUTION_NOTES.md](EXECUTION_NOTES.md) distinguishes chart validation from product evidence.
