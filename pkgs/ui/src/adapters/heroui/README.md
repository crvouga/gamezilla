# HeroUI Native adapter

Alternative `UIAdapter` implementation that routes the `@pkgs/ui` port surface to [HeroUI Native v3](https://heroui.com/docs/native). The in-house adapter (`adapters/inhouse/`) remains the default; this adapter overrides specific slots when `EXPO_PUBLIC_UI_IMPL=heroui` is set at build time.

## Boundary

`heroui-native`, `uniwind`, `tailwind-merge`, and `tailwind-variants` are confined to this folder by two enforcement layers:

1. `.dependency-cruiser.cjs` rule `heroui-confined-to-adapter` (defence-in-depth; only fires when the dep is part of the cruised graph).
2. `pkgs/ui/eslint.config.js` rule `no-restricted-imports` (primary enforcer — catches forbidden imports at parse-time).

Consumers (`apps/*`, `libs/*`, `pkgs/*`) cannot import `heroui-native` directly. They go through the `@pkgs/ui` public surface, which the boot-time `switch` in `pkgs/ui/src/adapter-registry.ts` resolves to either the in-house or HeroUI implementation.

## Implemented slots (Phase 2)

| Port slot  | HeroUI primitive                                                         |
| ---------- | ------------------------------------------------------------------------ |
| `Button`   | `Button` + `Button.Label` (variant maps from our `intent`)               |
| `Checkbox` | `Checkbox` + optional `ControlField` for label rows                      |
| `Chip`     | `Chip` (`primary` when selected, `soft` otherwise)                       |
| `Divider`  | `Separator`                                                              |
| `Skeleton` | `Skeleton` (`shimmer` variant)                                           |
| `Spinner`  | `Spinner` (size maps `small/medium/large` → `sm/md/lg`)                  |
| `Switch`   | `Switch` + `Switch.Thumb`                                                |
| `Text`     | `Text` (variant maps our `body`/`heading`/etc → HeroUI `h1`-`h6`/`body`) |

Every other slot in `UIAdapter` (about 64 of 72) falls through to the in-house adapter via the spread merge in `adapter-registry.ts`. New HeroUI implementations get added by:

1. Drop a `<slot>.tsx` file in this folder.
2. Import it in `index.ts` and add it to the `heroUIAdapter` object.
3. `bun run ci:ui-adapters` confirms the slot is recognised.

## Runtime activation (Phase 2b — not yet automated)

The component files compile against the installed `heroui-native` package, but HeroUI's `className` styling needs Uniwind + Tailwind v4 wired into the consuming app's build pipeline. Without that, components render but lack styles.

To activate HeroUI for `apps/client`:

1. **Add Uniwind / Tailwind to the babel + metro pipeline.** Follow [docs.uniwind.dev/quickstart](https://docs.uniwind.dev/quickstart). The catalog already pins `uniwind@^1.7.0` and `tailwindcss@^4.2.4`; install them in `apps/client/package.json` with `"uniwind": "catalog:"` + `"tailwindcss": "catalog:"`.
2. **Create `apps/client/global.css`:**
   ```css
   @import 'tailwindcss';
   @import 'uniwind';
   @import 'heroui-native/styles';
   @source './node_modules/heroui-native/lib';
   ```
3. **Mount `HeroUIThemeBridge`** (exported from this folder) inside `apps/client/src/providers/app-providers.tsx`, below the existing `ThemeProvider` and inside the `GestureHandlerRootView`:
   ```tsx
   import { HeroUIThemeBridge } from '@pkgs/ui/adapters/heroui';
   // ...
   <ThemeProvider>
     <GestureHandlerRootView style={{ flex: 1 }}>
       <HeroUIThemeBridge>{children}</HeroUIThemeBridge>
     </GestureHandlerRootView>
   </ThemeProvider>;
   ```
   (NB: the import path above is the only legitimate `pkgs/ui/src/adapters/**` import allowed by the depcruise `ui-adapter-internals-private` rule; we may want to lift it to a port-level `RootProvider` slot in `UIAdapter` instead, which would let `app-providers.tsx` consume the active adapter's provider through the public API.)
4. **Flip the env var.** Set `EXPO_PUBLIC_UI_IMPL=heroui` in `apps/client/.env.local` (or in Doppler's `local` config so `setup-env.ts` picks it up) and rebuild.

Until step 4 is set, `UI_IMPL` defaults to `'inhouse'` and the in-house adapter renders unchanged.

## react-native-web caveat

HeroUI Native v3 targets iOS / Android first; some components (BottomSheet, Popover, complex animations) may degrade on `react-native-web`. The fallthrough merge already shields us — slots we don't implement here keep using the in-house version on every platform. If a HeroUI-implemented slot proves web-broken, the cleanest fix is a per-platform branch in `adapter-registry.ts`:

```ts
function selectAdapter(): UIAdapter {
  switch (UI_IMPL) {
    case 'inhouse':
      return inhouseAdapter;
    case 'heroui':
      return Platform.OS === 'web'
        ? inhouseAdapter
        : { ...inhouseAdapter, ...heroUIAdapter };
  }
}
```

## See also

- `LLM.txt` in this folder — HeroUI Native v3 reference docs index.
- `pkgs/ui/src/ports/ui-adapter.ts` — the port contract every adapter must conform to.
- `scripts/check-ui-adapter-conformance.ts` — guarantees `heroUIAdapter` only overrides real `UIAdapter` slots.
