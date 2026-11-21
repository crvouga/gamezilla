# Spaces

A space is a room where one person hosts and everyone else plays along. Every space screen answers three questions at a glance: who is the host, what phase the space is in, and what you can do right now.

## Rules

- One status line at the top of every space screen, set in `title`, always present and always current: "bob is choosing a game", "bob is setting up Light Cycles", "Starting in 3", "bob is away".
- The host is marked on the avatar itself: a `tint` ring and a **Host** tag. Your own avatar is labelled **You**. Names sit under every avatar.
- The launcher is a grid of game tiles, four across on phones, one tile per game. Modes, variants and player counts never appear in the launcher; they live in each game's own setup screen.
- Tiles reflect fit with the room. A game that cannot be played by the people present is dimmed and says why in words ("Needs 4", "Solo"). When bots can fill seats, the host's tile says so ("4 · add 2 bots").
- Guests never see a selectable launcher. Tapping a tile suggests that game to the host; the tile the host is on is ringed in `tint` and labelled "bob is looking".
- A guest's only primary action is the one the phase allows: suggest while the host chooses, **I'm ready** during setup, nothing during the countdown.
- Invite is a secondary control in the people row, never the primary action of a space screen.

## Phases and roles

Each cell is a screen. An empty cell is a gap to fill before shipping, and each cell gets its own story in the app's Storybook (`Space/<Phase>/<Role>`).

| Phase | Host sees | Guest sees |
|---|---|---|
| Choosing | Selectable grid, guest suggestions marked | "bob is choosing a game", the host's current tile ringed |
| Setting up | The game's own setup screen | "bob is setting up X", settings read-only, **I'm ready** |
| Waiting for players | Seats, invite and bots | The same seats, invite if allowed |
| Starting | Countdown | Countdown |
| In game | The game | The game |
| Host away or left | n/a | "bob is away", or a host handoff |

Each built cell has its story in Storybook under `Space/<Phase>/<Role>`:
Choosing, Setting up, Waiting for players, Starting and In game for host and
guest, and Host away or left for the guest. Waiting for players is the
custom game lobby with an open seat, not a screen of its own.

Not built yet, and so without a story or with a gap against these rules:

- the host handoff when the host leaves;
- the guest's "bob is choosing a game" status and the ring on the host's
  current tile (the guest sees "The host picks the game for this space.");
- the guest's "bob is setting up X" status (the guest sees the seats and a
  Get ready command);
- "bob is away" wording (the guest sees the header's offline notice).
