# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--corner-recovery dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

- Expected  -   1
+ Received  + 172

- success
+ error: Unable to find an element with the text: Puzzle completed. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
+
+ Ignored nodes: comments, script, style
+ <div
+   id="storybook-root"
+ >
+   <div
+     class="themeHost bg-transparent bg-none"
+     data-component="ThemeProvider"
+     data-reduced-motion="true"
+     data-theme="dark"
+   >
+     <div
+       class="box flex-1 min-w-0 w-full max-w-full relative"
+       data-component="SurfaceStackRoot"
+       style="overflow:clip"
+     >
+       <div
+         class="box h-dvh min-h-0"
+         data-component="StoryAppViewport"
+       >
+         <main
+           class="box flex-1 min-h-0 bg-background"
+           data-component="AppFrame"
+           data-mode="compact"
+         >
+           <div
+             class="box flex-1 min-h-0 min-w-0"
+             data-component="DismissibleBannerPortalRoot"
+           >
+             <div
+               class="box shrink-0 w-full"
+               data-component="DismissibleBannerPortalHost"
+               data-position="top"
+             />
+             <div
+               class="box flex-1 min-h-0 min-w-0 relative"
+             >
+               <div
+                 class="box flex-1 min-h-0 min-w-0"
+                 data-region="content"
+               >
+                 <div
+                   class="scroll flex-1 self-stretch w-full"
+                   data-attemptid="a77e0000-0000-4000-8000-0000000000b1"
+                   data-component="GameScreen"
+                   data-packrevisionid="7c1e0a00-0000-4000-8000-0000000000b2"
+                   data-screen="puzzle-content-attempt"
+                   data-sourceid="7c1e0a00-0000-4000-8000-0000000000b1"
+                   data-testid="content-attempt"
+                   tabindex="0"
+                 >
+                   <div
+                     class="scrollContent gap-ui-lg px-ui-lg pt-ui-sm pb-ui-2xl w-full mx-auto"
+                     data-component="ScrollViewContent"
+                     style="max-width: 100%;"
+                   >
+                     <div
+                       class="_column_kllvv_7"
+                       data-component="GameColumn"
+                     >
+                       <div
+                         class="_heading_1rsau_4"
+                         data-component="GameHeading"
+                         data-keep-title="true"
+                       >
+                         <div
+                           class="_headingTitle_1rsau_23"
+                           data-component="GameHeadingTitle"
+                         >
+                           <div
+                             class="box gap-1 items-start py-2 min-w-0 self-stretch"
+                             data-component="ScreenIntro"
+                           >
+                             <h1
+                               class="text textTitle min-w-0 max-w-full break-words"
+                             >
+                               Two crates
+                             </h1>
+                           </div>
+                         </div>
+                         <div
+                           class="_facts_1rsau_11"
+                         >
+                           <span
+                             class="badge inline-flex shrink-0 self-start items-center justify-center min-w-0 max-w-full"
+                             data-component="Badge"
+                             data-intent="neutral"
+                             data-size="md"
+                             data-tone="subtle"
+                           >
+                             
+                             <span
+                               class="text whitespace-nowrap truncate"
+                             >
+                               Easy
+                             </span>
+                           </span>
+                         </div>
+                       </div>
+                       <div
+                         class="box gap-4 min-w-0 pb-6 _session_cevf0_51"
+                         data-board-focus="false"
+                         data-component="GameSessionLayout"
+                       >
+                         
+                         
+                         
+                         <p
+                           class="text textBody text-text-secondary"
+                           data-testid="puzzle-attempt-rule"
+                         >
+                           Push each crate onto a goal.
+                         </p>
+                         <div
+                           class="_layout_kllvv_8"
+                           data-arena="false"
+                           data-component="GameLayout"
+                           data-has-aside="true"
+                           data-has-setup="false"
+                           data-has-stage="true"
+                           data-stage-preview="false"
+                           data-workspace="false"
+                           style="--game-rail-rows: 2;"
+                         >
+                           
+                           <div
+                             class="_stage_kllvv_67"
+                           >
+                             <div
+                               class="box gap-ui-md"
+                             >
+                               <div
+                                 aria-describedby="cl-0"
+                                 aria-disabled="false"
+                                 aria-label="Sokoban board"
+                                 class="_board_1c2st_1"
+                                 data-component="TileBoard"
+                                 data-disabled="false"
+                                 data-size="fill"
+                                 data-testid="sokoban-board"
+                                 role="group"
+                                 style="--tile-board-columns: 6; --tile-board-rows: 4;"
+                                 tabindex="0"
+                               >
+                                 <div
+                                   class="_tiles_1c2st_96"
+                                 >
+                                   <span
+                                     aria-label="A1: wall"
+                                     class="_tile_1c2st_96"
+                                     data-marked="false"
+                                     data-terrain="solid"
+                                     data-testid="sokoban-board-tile-0"
+                                     role="img"
+                                   />
+                                   <span
+                                     aria-label="B1: wall"
+                                     class="_tile_1c2st_96"
+                                     data-marked="false"
+                                     data-terrain="solid"
+                                     data-testid="sokoban-board-tile-1"
+                                     role="img"
+                                   />
+                                   <span
+                                     aria-label="C1: wall"
+                                     class="_tile_1c2st_96"
+                                     data-marked="false"
+                                     data-terrain="solid"
+                                     data-testid="sokoban-board-tile-2"
+                                     role="img"
+        ...

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Two crates" [level=1] [ref=e16]
      - generic [ref=e19]: Easy
    - generic [ref=e20]:
      - paragraph [ref=e21]: Push each crate onto a goal.
      - generic [ref=e22]:
        - generic [ref=e24]:
          - group "Sokoban board" [active] [ref=e25]:
            - generic [ref=e26]:
              - 'img "A1: wall" [ref=e27]'
              - 'img "B1: wall" [ref=e28]'
              - 'img "C1: wall" [ref=e29]'
              - 'img "D1: wall" [ref=e30]'
              - 'img "E1: wall" [ref=e31]'
              - 'img "F1: wall" [ref=e32]'
              - 'img "A2: wall" [ref=e33]'
              - 'img "B2: floor" [ref=e34]'
              - 'img "C2: floor" [ref=e35]'
              - 'img "D2: floor, worker" [ref=e36]'
              - 'img "E2: goal, crate" [ref=e37]'
              - 'img "F2: wall" [ref=e39]'
              - 'img "A3: wall" [ref=e40]'
              - 'img "B3: floor" [ref=e41]'
              - 'img "C3: floor" [ref=e42]'
              - 'img "D3: floor" [ref=e43]'
              - 'img "E3: floor" [ref=e44]'
              - 'img "F3: wall" [ref=e45]'
              - 'img "A4: wall" [ref=e46]'
              - 'img "B4: wall" [ref=e47]'
              - 'img "C4: wall" [ref=e48]'
              - 'img "D4: wall" [ref=e49]'
              - 'img "E4: wall" [ref=e50]'
              - 'img "F4: wall" [ref=e51]'
            - generic:
              - generic:
                - generic: ▣
              - generic:
                - generic: ☻
          - generic [ref=e52]:
            - img [ref=e55]
            - generic [ref=e58]:
              - status [ref=e59]: All crates are on goals
              - paragraph [ref=e60]: Keep playing or choose another puzzle.
              - button "Choose another puzzle" [ref=e61] [cursor=pointer]:
                - paragraph [ref=e64]: Choose another puzzle
          - generic [ref=e65]:
            - generic [ref=e66]:
              - status [ref=e67]: Moves 6 · Pushes 2
              - paragraph [ref=e68]: Swipe, tap beside the worker, or use the pad.
            - group [ref=e69]:
              - button "Move up" [ref=e70] [cursor=pointer]:
                - img [ref=e71]
              - button "Move left" [ref=e73] [cursor=pointer]:
                - img [ref=e74]
              - button "Move right" [ref=e76] [cursor=pointer]:
                - img [ref=e77]
              - button "Move down" [ref=e79] [cursor=pointer]:
                - img [ref=e80]
        - generic [ref=e84]:
          - button "Undo" [ref=e85] [cursor=pointer]:
            - paragraph [ref=e88]: Undo
          - button "Redo" [disabled] [ref=e89]:
            - paragraph [ref=e92]: Redo
          - button "Restart" [ref=e93] [cursor=pointer]:
            - paragraph [ref=e96]: Restart
        - region "Puzzle 3 of 4 in Warehouse basics" [ref=e98]:
          - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e101]
          - progressbar "Puzzle 3 of 4" [ref=e103]
          - status [ref=e105]: Progress saved on this device.
          - status [ref=e106]:
            - img [ref=e109]
            - generic [ref=e112]:
              - paragraph [ref=e113]: Completion saved
              - paragraph [ref=e114]: Your completion is saved. You can keep playing or choose another puzzle.
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
> 35 |     .toBe('success');
     |      ^ Error: expect(received).toBe(expected) // Object.is equality
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
  51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```