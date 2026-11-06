# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-sokoban-puzzle--corner-recovery light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

- Expected  -   1
+ Received  + 163

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
+     data-theme="light"
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
+           class="box flex-1 min-h-0 min-w-0 w-full max-w-full bg-background overflow-clip"
+           data-component="AppFrame"
+           data-mode="wide"
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
+                 class="box flex-row flex-1 min-h-0 min-w-0"
+               >
+                 
+                 <div
+                   class="box flex-1 min-h-0 min-w-0"
+                 >
+                   <div
+                     class="box flex-1 min-h-0 min-w-0 w-full mx-auto max-w-ui-space px-4 pb-4 gap-2"
+                     data-region="column"
+                   >
+                     
+                     <div
+                       class="box flex-1 min-h-0 min-w-0"
+                       data-region="content"
+                     >
+                       <div
+                         class="scroll flex-1 self-stretch w-full"
+                         data-attemptid="a77e0000-0000-4000-8000-0000000000b1"
+                         data-component="GameScreen"
+                         data-packrevisionid="7c1e0a00-0000-4000-8000-0000000000b2"
+                         data-screen="puzzle-content-attempt"
+                         data-sourceid="7c1e0a00-0000-4000-8000-0000000000b1"
+                         data-testid="content-attempt"
+                         tabindex="0"
+                       >
+                         <div
+                           class="scrollContent gap-ui-lg pt-ui-sm pb-ui-2xl w-full mx-auto"
+                           data-component="ScrollViewContent"
+                           style="max-width: 100%;"
+                         >
+                           <div
+                             class="_column_kllvv_7"
+                             data-component="GameColumn"
+                           >
+                             <div
+                               class="_heading_1rsau_4"
+                               data-component="GameHeading"
+                               data-keep-title="true"
+                             >
+                               <div
+                                 class="_headingTitle_1rsau_23"
+                                 data-component="GameHeadingTitle"
+                               >
+                                 <div
+                                   class="box gap-1 items-start py-2 min-w-0 self-stretch"
+                                   data-component="ScreenIntro"
+                                 >
+                                   <h1
+                                     class="text textTitle min-w-0 max-w-full break-words"
+                                   >
+                                     Two crates
+                                   </h1>
+                                 </div>
+                               </div>
+                               <div
+                                 class="_facts_1rsau_11"
+                               >
+                                 <span
+                                   class="badge inline-flex shrink-0 self-start items-center justify-center min-w-0 max-w-full"
+                                   data-component="Badge"
+                                   data-intent="neutral"
+                                   data-size="md"
+                                   data-tone="subtle"
+                                 >
+                                   
+                                   <span
+                                     class="text whitespace-nowrap truncate"
+                                   >
+                                     Easy
+                                   </span>
+                                 </span>
+                               </div>
+                             </div>
+                             <div
+                               class="box gap-4 min-w-0 pb-6 _session_cevf0_51"
+                               data-board-focus="false"
+                               data-component="GameSessionLayout"
+                             >
+                               
+                               
+                               
+                               <p
+                                 class="text textBody text-text-secondary"
+                                 data-testid="puzzle-attempt-rule"
+                               >
+                                 Push each crate onto a goal.
+                               </p>
+                               <div
+                                 class="_layout_kllvv_8"
+                                 data-arena="false"
+                                 data-component="GameLayout"
+                                 data-has-aside="true"
+                                 data-has-setup="false"
+                                 data-has-stage="true"
+                                 data-stage-preview="false"
+                                 data-workspace="false"
+                                 style="--game-rail-rows: 2;"
+                               >
+                                 
+                                 <div
+                                   class="_stage_kllvv_67"
+                                 >
+                                   <div
+                                     class="box gap-ui-md"
+                                   >
+                                     <div
+                                       aria-describedby="cl-0"
+                                       aria-disabled="false"
+                                       aria-label="Sokoban board"
+                                       class="_board_1c2st_1"
+                                       data-component="TileBoard"
+                                       data-disabled="false"
+                                       data-size="fill"
+                                       data-testid="sokoban-board"
+                                       role="group"
+                                       style="--tile-board-columns: 6; --tile-board-rows: 4;"
+                                       tabindex="0"
+                                     >
+                                       <div
+                                         class="_tiles_1c2st_96"
+                                       >
+                                         <span
+                                           aria-label="A1: wall"
+                                     ...

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Two crates" [level=1] [ref=e19]
      - generic [ref=e22]: Easy
    - generic [ref=e23]:
      - paragraph [ref=e24]: Push each crate onto a goal.
      - generic [ref=e25]:
        - generic [ref=e27]:
          - group "Sokoban board" [active] [ref=e28]:
            - generic [ref=e29]:
              - 'img "A1: wall" [ref=e30]'
              - 'img "B1: wall" [ref=e31]'
              - 'img "C1: wall" [ref=e32]'
              - 'img "D1: wall" [ref=e33]'
              - 'img "E1: wall" [ref=e34]'
              - 'img "F1: wall" [ref=e35]'
              - 'img "A2: wall" [ref=e36]'
              - 'img "B2: floor" [ref=e37]'
              - 'img "C2: floor" [ref=e38]'
              - 'img "D2: floor, worker" [ref=e39]'
              - 'img "E2: goal, crate" [ref=e40]'
              - 'img "F2: wall" [ref=e42]'
              - 'img "A3: wall" [ref=e43]'
              - 'img "B3: floor" [ref=e44]'
              - 'img "C3: floor" [ref=e45]'
              - 'img "D3: floor" [ref=e46]'
              - 'img "E3: floor" [ref=e47]'
              - 'img "F3: wall" [ref=e48]'
              - 'img "A4: wall" [ref=e49]'
              - 'img "B4: wall" [ref=e50]'
              - 'img "C4: wall" [ref=e51]'
              - 'img "D4: wall" [ref=e52]'
              - 'img "E4: wall" [ref=e53]'
              - 'img "F4: wall" [ref=e54]'
            - generic:
              - generic:
                - generic: ▣
              - generic:
                - generic: ☻
          - generic [ref=e55]:
            - img [ref=e58]
            - generic [ref=e61]:
              - status [ref=e62]: All crates are on goals
              - paragraph [ref=e63]: Keep playing or choose another puzzle.
              - button "Choose another puzzle" [ref=e64] [cursor=pointer]:
                - paragraph [ref=e67]: Choose another puzzle
          - generic [ref=e69]:
            - status [ref=e70]: Moves 6 · Pushes 2
            - paragraph [ref=e71]: Move with the arrow keys or W A S D, or click a square beside the worker.
        - generic [ref=e74]:
          - button "Undo" [ref=e75] [cursor=pointer]:
            - paragraph [ref=e78]: Undo
          - button "Redo" [disabled] [ref=e79]:
            - paragraph [ref=e82]: Redo
          - button "Restart" [ref=e83] [cursor=pointer]:
            - paragraph [ref=e86]: Restart
        - region "Puzzle 3 of 4 in Warehouse basics" [ref=e88]:
          - heading "Puzzle 3 of 4 in Warehouse basics" [level=2] [ref=e91]
          - progressbar "Puzzle 3 of 4" [ref=e93]
          - status [ref=e95]: Progress saved on this device.
          - status [ref=e96]:
            - img [ref=e99]
            - generic [ref=e102]:
              - paragraph [ref=e103]: Completion saved
              - paragraph [ref=e104]: Your completion is saved. You can keep playing or choose another puzzle.
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