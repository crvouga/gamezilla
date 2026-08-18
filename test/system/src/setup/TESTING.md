# System tests (DST)

Product system graph and DST worlds live in `@libs/runtime` (`defineSystem` /
`createWorld` / AppUi facades). Open a world with `openSim` from
`test/system/src/setup/open-sim.ts`.

View captured timelines in the product client **Console** tab
(`SystemConsoleApp`). Locally (`bun dev`), reports are served from
`<repo>/system-console-data` by `@pkgs/system-console#dev` on port 7789.
`openSim` writes into that directory; the API Worker `/system-console` mount
(MinIO / B2) is for non-local / production browsing.
