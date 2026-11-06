# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-puzzles-chess-play--solution-shown dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  58237 pixels (ratio 0.18 of all image pixels) are different.

  Snapshot: libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/solution-shown-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/solution-shown-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 58237 pixels (ratio 0.18 of all image pixels) are different.
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
  - 58237 pixels (ratio 0.18 of all image pixels) are different.

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
        - generic [ref=e42]: ✕
        - paragraph [ref=e44]: Failed
        - generic [ref=e45]:
          - img [ref=e47]
          - paragraph [ref=e50]: 0:12
      - status [ref=e51]: Knight takes e5, even with the queen pinned.
    - generic [ref=e57]:
      - generic [ref=e58]:
        - paragraph [ref=e59]: White pieces nearest you.
        - paragraph [ref=e60]: "Tap a piece, then its destination. Keyboard: arrows to move, Enter to choose, Escape to cancel."
      - generic [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]: "8"
          - generic [ref=e67]: "7"
          - generic [ref=e68]: "6"
          - generic [ref=e69]: "5"
          - generic [ref=e70]: "4"
          - generic [ref=e71]: "3"
          - generic [ref=e72]: "2"
          - generic [ref=e73]: "1"
        - application "Chess board, white facing you" [ref=e75]:
          - status [ref=e76]
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
            - button "f3, White knight"
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
            - button "e1, White king"
            - button "f1, empty"
            - button "g1, empty"
            - button "h1, White rook"
        - generic [ref=e94]:
          - generic [ref=e95]: a
          - generic [ref=e96]: b
          - generic [ref=e97]: c
          - generic [ref=e98]: d
          - generic [ref=e99]: e
          - generic [ref=e100]: f
          - generic [ref=e101]: g
          - generic [ref=e102]: h
    - generic [ref=e104]:
      - generic [ref=e106]:
        - button "Next" [ref=e107] [cursor=pointer]:
          - generic [ref=e109]:
            - paragraph [ref=e110]: Next
            - img [ref=e113]
        - button "Retry" [ref=e115] [cursor=pointer]:
          - generic [ref=e117]:
            - img [ref=e120]
            - paragraph [ref=e123]: Retry
      - 'button "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match. This puzzle Puzzle rating 1702 mate, opening, sacrifice Settings Auto target 1500 · Unseen · All themes" [ref=e124] [cursor=pointer]':
        - generic [ref=e125]: "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match."
        - generic [ref=e126]:
          - generic [ref=e127]:
            - generic [ref=e128]:
              - paragraph [ref=e129]: This puzzle
              - generic [ref=e131]: Puzzle rating 1702
              - generic [ref=e133]: mate, opening, sacrifice
            - generic [ref=e134]:
              - img [ref=e136]
              - generic [ref=e137]: Settings
          - paragraph [ref=e138]: Auto target 1500 · Unseen · All themes
    - generic [ref=e140]:
      - generic [ref=e141]:
        - paragraph [ref=e142]: Moves
        - generic [ref=e143]:
          - generic [ref=e144]:
            - button "Jump to start" [ref=e145] [cursor=pointer]:
              - img [ref=e148]
            - button "Previous move" [ref=e151] [cursor=pointer]:
              - img [ref=e154]
          - generic [ref=e156]:
            - button "Next move" [disabled] [ref=e157]:
              - img [ref=e160]
            - button "Jump to end" [disabled] [ref=e162]:
              - img [ref=e165]
      - button "4… g6" [pressed] [ref=e171] [cursor=pointer]:
        - generic [ref=e172]:
          - generic [ref=e173]: 4…
          - code [ref=e174]: g6
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