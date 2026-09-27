# Chess board UI suite

One suite, written against the `@pkgs/ui-testing` `Driver`. A host supplies the
driver, so swapping the implementation never touches a scenario:

| Host | Command | Engine |
| --- | --- | --- |
| happy-dom (in-process) | `bun run --filter @pkgs/chess-board test` | Solid in happy-dom via `@pkgs/ui-testing-solid-dom`, virtual clock |

## Layout

```text
tests/ui/
  harness/     the page under test: one board + a "parent" that owns its props
               (FEN, sync key, orientation, toggles), buttons to change them and
               text logs of what the board emitted (moves, sounds, user arrows)
  suite/       ChessBoardHost port, BoardPage page object, chess.js oracle,
               scenarios/* (one describe per concern)
  hosts/       happy-dom host
```

## What a test can observe

Only what a driver can read by test id:

- **Probe** (`<board>-probe`): model state as JSON — FEN, turn, check,
  status, selection, legal targets, last move, open promotion, premove queue,
  keyboard cursor.
- **Paint tokens** (`<board>-layer-{squares,pieces,shapes,arrows,feedback}`):
  in E2E builds every painted node carries an invisible `⟦kind:detail@at⟧`
  token, so a layer's text is what is actually drawn (`piece:wp@e4`,
  `selected@e2`, `dot@e3`, `arrow:primary@e2-e4`, …). `BoardPage.expectConsistent`
  asserts painted pieces and overlays match the probe.
- **Harness logs**: emitted moves, sounds played (recording audio port), user
  arrows, and slides started (recording motion environment:
  `piece:from>to@ms`, with `hand` for a piece the pointer left and `mid` for
  one caught mid-flight).

## Adding a scenario

Add a `test` to the matching `suite/scenarios/*.ts` (or a new file registered in
`define-chess-board-suite.ts`). Use `openBoard(host, config)`, gestures on
`BoardPage` (`tap`, `drag`, `clickMove`, `key`, `rightDrag`, `promote`, …) and
assert on reads — never on host internals, so the test runs on any host.
Model-based runs (`scenarios/model-based.ts`) replay from their seed.
