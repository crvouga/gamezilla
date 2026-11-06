# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-puzzles-chess-play--hint dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  111575 pixels (ratio 0.34 of all image pixels) are different.

  Snapshot: libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/hint-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/hint-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 111575 pixels (ratio 0.34 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 111575 pixels (ratio 0.34 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - generic [ref=e15]:
      - heading "Puzzles" [level=1] [ref=e17]
      - generic [ref=e19]:
        - generic [ref=e20]:
          - img [ref=e22]
          - generic [ref=e24]: "3"
          - generic [ref=e25]: in a row
        - generic [ref=e26]:
          - img [ref=e28]
          - generic [ref=e31]: "24"
          - generic [ref=e32]: solved
    - generic [ref=e38]:
      - generic [ref=e39]:
        - paragraph [ref=e41]:
          - generic [ref=e43]: White to move
        - generic [ref=e44]:
          - img [ref=e46]
          - paragraph [ref=e49]: 0:12
      - status [ref=e50]: Look at the knight on f3. What can it take?
    - generic [ref=e54]:
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: "8"
          - generic [ref=e59]: "7"
          - generic [ref=e60]: "6"
          - generic [ref=e61]: "5"
          - generic [ref=e62]: "4"
          - generic [ref=e63]: "3"
          - generic [ref=e64]: "2"
          - generic [ref=e65]: "1"
        - application "Chess board, white facing you" [ref=e67]:
          - status [ref=e68]
          - img
          - generic:
            - button "a8, Black rook"
            - button "b8, Black knight"
            - button "c8, empty"
            - button "d8, Black queen"
            - button "e8, Black king"
            - button "f8, Black bishop"
            - button "g8, Black knight"
            - button "h8, Black rook"
            - button "a7, Black pawn"
            - button "b7, Black pawn"
            - button "c7, Black pawn"
            - button "d7, empty"
            - button "e7, empty"
            - button "f7, Black pawn"
            - button "g7, empty"
            - button "h7, Black pawn"
            - button "a6, empty"
            - button "b6, empty"
            - button "c6, empty"
            - button "d6, Black pawn"
            - button "e6, empty"
            - button "f6, empty"
            - button "g6, Black pawn"
            - button "h6, empty"
            - button "a5, empty"
            - button "b5, empty"
            - button "c5, empty"
            - button "d5, empty"
            - button "e5, Black pawn"
            - button "f5, empty"
            - button "g5, empty"
            - button "h5, empty"
            - button "a4, empty"
            - button "b4, empty"
            - button "c4, White bishop"
            - button "d4, empty"
            - button "e4, White pawn"
            - button "f4, empty"
            - button "g4, Black bishop"
            - button "h4, empty"
            - button "a3, empty"
            - button "b3, empty"
            - button "c3, White knight"
            - button "d3, empty"
            - button "e3, empty"
            - 'button "f3, White knight, Hint: move this piece"'
            - button "g3, empty"
            - button "h3, empty"
            - button "a2, White pawn"
            - button "b2, White pawn"
            - button "c2, White pawn"
            - button "d2, White pawn"
            - button "e2, empty"
            - button "f2, White pawn"
            - button "g2, White pawn"
            - button "h2, White pawn"
            - button "a1, White rook"
            - button "b1, empty"
            - button "c1, White bishop"
            - button "d1, White queen"
            - button "e1, White king" [active]
            - button "f1, empty"
            - button "g1, empty"
            - button "h1, White rook"
        - generic [ref=e86]:
          - generic [ref=e87]: a
          - generic [ref=e88]: b
          - generic [ref=e89]: c
          - generic [ref=e90]: d
          - generic [ref=e91]: e
          - generic [ref=e92]: f
          - generic [ref=e93]: g
          - generic [ref=e94]: h
      - paragraph [ref=e95]: White pieces nearest you.
      - generic [ref=e96]:
        - paragraph [ref=e97]: Tap a piece, then a square.
        - group [ref=e98]:
          - generic "Keyboard controls" [ref=e99] [cursor=pointer]
    - generic [ref=e101]:
      - generic [ref=e103]:
        - button "Reveal move" [ref=e104] [cursor=pointer]:
          - generic [ref=e106]:
            - img [ref=e109]
            - paragraph [ref=e111]: Reveal move
        - button "Skip puzzle" [ref=e112] [cursor=pointer]:
          - paragraph [ref=e115]: Skip puzzle
      - 'button "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match. This puzzle Settings Auto target 1500 · Unseen · All themes" [ref=e116] [cursor=pointer]':
        - generic [ref=e117]: "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match."
        - generic [ref=e118]:
          - generic [ref=e119]:
            - paragraph [ref=e121]: This puzzle
            - generic [ref=e122]:
              - img [ref=e124]
              - generic [ref=e125]: Settings
          - paragraph [ref=e126]: Auto target 1500 · Unseen · All themes
    - generic [ref=e128]:
      - generic [ref=e129]:
        - paragraph [ref=e130]: Moves
        - generic [ref=e131]:
          - generic [ref=e132]:
            - button "Jump to start" [ref=e133] [cursor=pointer]:
              - img [ref=e136]
            - button "Previous move" [ref=e139] [cursor=pointer]:
              - img [ref=e142]
          - generic [ref=e144]:
            - button "Next move" [disabled] [ref=e145]:
              - img [ref=e148]
            - button "Jump to end" [disabled] [ref=e150]:
              - img [ref=e153]
      - generic [ref=e157]:
        - button "4… g6" [pressed] [ref=e159] [cursor=pointer]:
          - generic [ref=e160]:
            - generic [ref=e161]: 4…
            - code [ref=e162]: g6
        - generic [ref=e163]: Your move
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
  35 |     .toBe('success');
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
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```