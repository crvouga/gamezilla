# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-chess-board--checkmated dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1180 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/checkmated-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/checkmated-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1180 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1180 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e27]: Live
        - list "Moves played" [ref=e32]:
          - listitem [ref=e33]:
            - generic [ref=e34]: Move 2
            - generic [ref=e35]:
              - generic [ref=e37]: ♔
              - 'button "Move 3, White: g4" [ref=e38] [cursor=pointer]': g4
            - generic [ref=e39]:
              - generic [ref=e41]: ♚
              - 'button "Move 4, Black: Qh4#" [ref=e42] [cursor=pointer]': Qh4#
        - button "All moves" [ref=e43] [cursor=pointer]:
          - img [ref=e47]
      - generic [ref=e49]:
        - generic [ref=e51]:
          - generic [ref=e58]:
            - img "Black" [ref=e59]:
              - generic [ref=e60]: ♚
            - generic [ref=e61]: jordan_plays
          - generic [ref=e63]:
            - paragraph [ref=e64]: White pieces nearest you. White is in check.
            - generic [ref=e66]:
              - generic [ref=e67]:
                - generic [ref=e68]: "8"
                - generic [ref=e69]: "7"
                - generic [ref=e70]: "6"
                - generic [ref=e71]: "5"
                - generic [ref=e72]: "4"
                - generic [ref=e73]: "3"
                - generic [ref=e74]: "2"
                - generic [ref=e75]: "1"
              - application "Chess board, white facing you" [ref=e77]:
                - status [ref=e78]
                - generic:
                  - button "a8, Black rook"
                  - button "b8, Black knight"
                  - button "c8, Black bishop"
                  - button "d8, empty"
                  - button "e8, Black king"
                  - button "f8, Black bishop"
                  - button "g8, Black knight"
                  - button "h8, Black rook"
                  - button "a7, Black pawn"
                  - button "b7, Black pawn"
                  - button "c7, Black pawn"
                  - button "d7, Black pawn"
                  - button "e7, empty"
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
                  - button "e5, Black pawn"
                  - button "f5, empty"
                  - button "g5, empty"
                  - button "h5, empty"
                  - button "a4, empty"
                  - button "b4, empty"
                  - button "c4, empty"
                  - button "d4, empty"
                  - button "e4, empty"
                  - button "f4, empty"
                  - button "g4, White pawn"
                  - button "h4, Black queen"
                  - button "a3, empty"
                  - button "b3, empty"
                  - button "c3, empty"
                  - button "d3, empty"
                  - button "e3, empty"
                  - button "f3, White pawn"
                  - button "g3, empty"
                  - button "h3, empty"
                  - button "a2, White pawn"
                  - button "b2, White pawn"
                  - button "c2, White pawn"
                  - button "d2, White pawn"
                  - button "e2, White pawn"
                  - button "f2, empty"
                  - button "g2, empty"
                  - button "h2, White pawn"
                  - button "a1, White rook"
                  - button "b1, White knight"
                  - button "c1, White bishop"
                  - button "d1, White queen"
                  - button "e1, White king"
                  - button "f1, White bishop"
                  - button "g1, White knight"
                  - button "h1, White rook"
              - generic [ref=e80]:
                - generic [ref=e81]: a
                - generic [ref=e82]: b
                - generic [ref=e83]: c
                - generic [ref=e84]: d
                - generic [ref=e85]: e
                - generic [ref=e86]: f
                - generic [ref=e87]: g
                - generic [ref=e88]: h
          - status [ref=e92]:
            - generic [ref=e93]:
              - generic [ref=e94]: "White: avery. Black: jordan_plays."
              - text: By checkmate.
          - generic [ref=e102]:
            - img "White" [ref=e103]:
              - generic [ref=e104]: ♔
            - generic [ref=e105]: avery
        - generic [ref=e106]:
          - generic [ref=e107]:
            - heading "jordan_plays wins" [level=2] [ref=e109]
            - list "Standings" [ref=e110]:
              - listitem [ref=e111]:
                - generic [ref=e112]:
                  - generic [ref=e113]: 1st
                  - generic [ref=e116]: jordan_plays
              - listitem [ref=e117]:
                - generic [ref=e118]:
                  - generic [ref=e119]: 2nd
                  - generic [ref=e122]: avery
          - generic [ref=e124]:
            - group "What next" [ref=e125]:
              - button "Rematch" [ref=e126] [cursor=pointer]:
                - paragraph [ref=e129]: Rematch
              - button "Change game" [ref=e130] [cursor=pointer]:
                - paragraph [ref=e133]: Change game
              - button "Review" [ref=e134] [cursor=pointer]:
                - paragraph [ref=e137]: Review
            - button "History and stats" [ref=e138] [cursor=pointer]:
              - generic [ref=e140]:
                - paragraph [ref=e141]: History and stats
                - img [ref=e144]
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