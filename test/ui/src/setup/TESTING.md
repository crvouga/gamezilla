# UI / system DST testing

Product system graph and DST worlds live in `@libs/runtime` (`defineSystem` /
`createWorld` / AppUi facades). Open a world with `openSim` from
`test/ui/src/setup/open-sim.ts`.

View captured timelines in the product client **Console** tab
(`SystemConsoleApp` from `@pkgs/system-console/client`, served by the API at
`/system-console`).
