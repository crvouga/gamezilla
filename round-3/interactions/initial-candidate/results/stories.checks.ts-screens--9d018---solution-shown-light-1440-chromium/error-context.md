# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-puzzles-chess-play--solution-shown light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  137825 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/solution-shown-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-puzzle-client-ts/src/baselines/chromium/screens-puzzles-chess-play/solution-shown-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 137825 pixels (ratio 0.12 of all image pixels) are different.
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
  - 137825 pixels (ratio 0.12 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e16]:
    - generic [ref=e18]:
      - heading "Puzzles" [level=1] [ref=e20]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - img [ref=e25]
          - generic [ref=e27]: "3"
          - generic [ref=e28]: in a row
        - generic [ref=e29]:
          - img [ref=e31]
          - generic [ref=e34]: "24"
          - generic [ref=e35]: solved
    - generic [ref=e37]:
      - 'button "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match. This puzzle Puzzle rating 1702 mate, opening, sacrifice Settings Auto target 1500 · Unseen · All themes" [ref=e38] [cursor=pointer]':
        - generic [ref=e39]: "Puzzle 00a3f. Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 1240 of 3000 puzzles match."
        - generic [ref=e40]:
          - generic [ref=e41]:
            - generic [ref=e42]:
              - paragraph [ref=e43]: This puzzle
              - generic [ref=e45]: Puzzle rating 1702
              - generic [ref=e47]: mate, opening, sacrifice
            - generic [ref=e48]:
              - img [ref=e50]
              - generic [ref=e51]: Settings
          - paragraph [ref=e52]: Auto target 1500 · Unseen · All themes
      - generic [ref=e57]:
        - generic [ref=e58]:
          - generic [ref=e61]: ✕
          - paragraph [ref=e63]: Failed
          - generic [ref=e64]:
            - img [ref=e66]
            - paragraph [ref=e69]: 0:12
        - status [ref=e70]: Knight takes e5, even with the queen pinned.
    - generic [ref=e76]:
      - generic [ref=e77]:
        - paragraph [ref=e78]: White pieces nearest you.
        - paragraph [ref=e79]: "Tap a piece, then its destination. Keyboard: arrows to move, Enter to choose, Escape to cancel."
      - generic [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]: "8"
          - generic [ref=e86]: "7"
          - generic [ref=e87]: "6"
          - generic [ref=e88]: "5"
          - generic [ref=e89]: "4"
          - generic [ref=e90]: "3"
          - generic [ref=e91]: "2"
          - generic [ref=e92]: "1"
        - application "Chess board, white facing you" [ref=e94]:
          - status [ref=e95]
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
        - generic [ref=e113]:
          - generic [ref=e114]: a
          - generic [ref=e115]: b
          - generic [ref=e116]: c
          - generic [ref=e117]: d
          - generic [ref=e118]: e
          - generic [ref=e119]: f
          - generic [ref=e120]: g
          - generic [ref=e121]: h
    - generic [ref=e125]:
      - button "Next" [ref=e126] [cursor=pointer]:
        - generic [ref=e128]:
          - paragraph [ref=e129]: Next
          - img [ref=e132]
      - button "Retry" [ref=e134] [cursor=pointer]:
        - generic [ref=e136]:
          - img [ref=e139]
          - paragraph [ref=e142]: Retry
    - generic [ref=e144]:
      - generic [ref=e145]:
        - paragraph [ref=e146]: Moves
        - generic [ref=e147]:
          - generic [ref=e148]:
            - button "Jump to start" [ref=e149] [cursor=pointer]:
              - img [ref=e152]
            - button "Previous move" [ref=e155] [cursor=pointer]:
              - img [ref=e158]
          - generic [ref=e160]:
            - button "Next move" [disabled] [ref=e161]:
              - img [ref=e164]
            - button "Jump to end" [disabled] [ref=e166]:
              - img [ref=e169]
      - button "4… g6" [pressed] [ref=e175] [cursor=pointer]:
        - generic [ref=e176]:
          - generic [ref=e177]: 4…
          - code [ref=e178]: g6
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