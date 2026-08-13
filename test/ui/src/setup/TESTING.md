# UI / system DST testing

Product system graph and DST worlds live in `@libs/runtime` (`defineSystem` /
`createWorld` / AppUi facades). Open a world with `openSim` from
`test/ui/src/setup/open-sim.ts`.

View captured timelines with `@pkgs/system-console`
(`bun run --filter @pkgs/system-console dev`).
