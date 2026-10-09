# Gherkin source ownership

The compiler retains every authoritative `.feature` file as a complete source card and derives exact business example cards alongside it. Rule headings, explanatory prose and scenario descriptions remain available in the full document. Backgrounds are included in the examples, outline rows become concrete examples, and tables and detailed outcomes are retained. The current catalog contains 231 complete feature documents and 1,636 expanded examples from those files.

Ownership belongs to a composed capability. The compiler collects a module's source references, removes their line fragments, and attaches matching examples to that module's host in the single product chart. A source may inform several capabilities. Individual state descriptions and line references explain particular outcomes; an arbitrary leaf state is never treated as the owner of every rule in a feature.

| Source context | Composed capabilities |
| --- | --- |
| [Auth](../../specs/auth/) | [Signing in](sign-in.machine.yaml) |
| [Billing](../../specs/billing/) | [Billing](billing.machine.yaml) |
| [Chess](../../specs/chess/) | [Game choices](games.machine.yaml), [puzzles](puzzles.machine.yaml), [feed](puzzle-feed.machine.yaml), [links](puzzle-links.machine.yaml), [history](puzzle-history.machine.yaml), [import](puzzle-ingest.machine.yaml), [Custom Games](custom-game.machine.yaml), [multiplayer](multiplayer.machine.yaml) |
| [Chessboard](../../specs/chess-board/) | [Independent chessboard contract](chess-board.machine.yaml) |
| [Database maintenance](../../specs/db-indexes/) | [Maintenance contract](database-maintenance.machine.yaml) |
| [Developer tools](../../specs/developer-tools/) | [Test worlds](test-worlds.machine.yaml), [notebooks](notebook.machine.yaml), [reports](reports.machine.yaml), [release evidence](release.machine.yaml), [inspection scope](inspectors.machine.yaml) |
| [Feedback](../../specs/feedback/) | [Feedback](feedback.machine.yaml) |
| [Friends](../../specs/friends/) | [Friendships](friends.machine.yaml), [inbox](inbox.machine.yaml) |
| [Journeys](../../specs/journeys/) | [Whole-product root](product.machine.yaml) |
| [Matchmaking](../../specs/matchmaking/) | [Independent matchmaking contract](matchmaking.machine.yaml) |
| [Profile](../../specs/profile/) | [Identity](identity.machine.yaml), [profile and devices](profile.machine.yaml), [signing in](sign-in.machine.yaml), [sign-in methods](sign-in-methods.machine.yaml), [privacy](privacy.machine.yaml) |
| [Room](../../specs/room/) | [Independent room contract](room.machine.yaml) |
| [Runtime](../../specs/runtime/) | [App navigation](app.machine.yaml), [settings](settings.machine.yaml), [opening and updates](connection.machine.yaml), [environment](environment.machine.yaml), [inspection scope](inspectors.machine.yaml) |
| [Spaces](../../specs/spaces/) | [Spaces](spaces.machine.yaml) |
| [Sync engine](../../specs/sync-engine/) | [Independent notes contract](notes.machine.yaml), related [inspection scope](inspectors.machine.yaml) |

This table locates source families; the current exact examples and their source addresses are in `.cache/product-statechart/contracts.json`, produced by `bun atlas:lint`. The compiled capability catalogs in `.cache/product-statechart/specs/product.machine.json` record their actual module ownership and can be read in the viewer's state details or search. A newly added feature without an owner fails compilation.

Source ownership is traceability. It does not assert that every scenario has a separate graph edge or that its application acceptance check has run. The authoritative coverage rules remain [specs/README.md](../../specs/README.md); [EXECUTION_NOTES.md](EXECUTION_NOTES.md) distinguishes chart validation from product evidence.
