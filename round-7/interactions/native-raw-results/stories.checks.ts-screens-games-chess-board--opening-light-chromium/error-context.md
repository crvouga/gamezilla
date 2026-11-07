# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-chess-board--opening light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  74272 pixels (ratio 0.23 of all image pixels) are different.

  Snapshot: libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/opening-light.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/opening-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 74272 pixels (ratio 0.23 of all image pixels) are different.
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
  - 74272 pixels (ratio 0.23 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Chess" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e24]:
        - paragraph [ref=e29]: No moves yet.
        - button "All moves" [ref=e30] [cursor=pointer]:
          - img [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e38]:
          - generic [ref=e45]:
            - img "Black" [ref=e46]:
              - generic [ref=e47]: ♚
            - generic "jordan_plays" [ref=e50]
          - generic [ref=e52]:
            - paragraph [ref=e53]: White pieces nearest you.
            - generic [ref=e54]:
              - paragraph [ref=e55]: Tap a piece, then a square.
              - group [ref=e56]:
                - generic "Keyboard controls" [ref=e57] [cursor=pointer]
            - generic [ref=e59]:
              - generic [ref=e60]:
                - generic [ref=e61]: "8"
                - generic [ref=e62]: "7"
                - generic [ref=e63]: "6"
                - generic [ref=e64]: "5"
                - generic [ref=e65]: "4"
                - generic [ref=e66]: "3"
                - generic [ref=e67]: "2"
                - generic [ref=e68]: "1"
              - application "Chess board, white facing you" [ref=e70]:
                - status [ref=e71]: Pawn to e4
                - generic:
                  - button "a8, Black rook"
                  - button "b8, Black knight"
                  - button "c8, Black bishop"
                  - button "d8, Black queen"
                  - button "e8, Black king"
                  - button "f8, Black bishop"
                  - button "g8, Black knight"
                  - button "h8, Black rook"
                  - button "a7, Black pawn"
                  - button "b7, Black pawn"
                  - button "c7, Black pawn"
                  - button "d7, Black pawn"
                  - button "e7, Black pawn"
                  - button "f7, Black pawn"
                  - button "g7, Black pawn"
                  - button "h7, Black pawn"
                  - button "a6, empty"
                  - button "b6, empty"
                  - button "c6, empty"
                  - button "d6, empty"
                  - button "e6, empty"
                  - button "f6, empty"
                  - button "g6, empty"
                  - button "h6, empty"
                  - button "a5, empty"
                  - button "b5, empty"
                  - button "c5, empty"
                  - button "d5, empty"
                  - button "e5, empty"
                  - button "f5, empty"
                  - button "g5, empty"
                  - button "h5, empty"
                  - button "a4, empty"
                  - button "b4, empty"
                  - button "c4, empty"
                  - button "d4, empty"
                  - button "e4, White pawn" [active]
                  - button "f4, empty"
                  - button "g4, empty"
                  - button "h4, empty"
                  - button "a3, empty"
                  - button "b3, empty"
                  - button "c3, empty"
                  - button "d3, empty"
                  - button "e3, empty"
                  - button "f3, empty"
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
                  - button "b1, White knight"
                  - button "c1, White bishop"
                  - button "d1, White queen"
                  - button "e1, White king"
                  - button "f1, White bishop"
                  - button "g1, White knight"
                  - button "h1, White rook"
              - generic [ref=e89]:
                - generic [ref=e90]: a
                - generic [ref=e91]: b
                - generic [ref=e92]: c
                - generic [ref=e93]: d
                - generic [ref=e94]: e
                - generic [ref=e95]: f
                - generic [ref=e96]: g
                - generic [ref=e97]: h
          - status [ref=e99]:
            - generic [ref=e100]:
              - generic [ref=e101]: "White: avery. Black: jordan_plays."
              - text: White to move.
          - generic [ref=e109]:
            - img "White" [ref=e110]:
              - generic [ref=e111]: ♔
            - generic "avery" [ref=e114]
            - generic [ref=e115]: Your move
        - generic [ref=e118]:
          - group "Game actions" [ref=e119]:
            - button "Offer draw" [ref=e120] [cursor=pointer]:
              - paragraph [ref=e123]: Offer draw
            - button "Resign game" [ref=e124] [cursor=pointer]:
              - paragraph [ref=e127]:
                - text: Resign
                - generic [ref=e128]: game
          - button "History and stats" [ref=e129] [cursor=pointer]:
            - generic [ref=e131]:
              - paragraph [ref=e132]: History and stats
              - img [ref=e135]
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