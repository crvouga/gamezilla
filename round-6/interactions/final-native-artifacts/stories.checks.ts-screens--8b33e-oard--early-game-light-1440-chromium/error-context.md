# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-chess-board--early-game light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  200164 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/early-game-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/early-game-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 200164 pixels (ratio 0.17 of all image pixels) are different.
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
  - 200164 pixels (ratio 0.17 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Chess" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e34]:
          - img "Black" [ref=e35]:
            - generic [ref=e36]: ♚
          - generic "jordan_plays" [ref=e39]
        - generic [ref=e41]:
          - paragraph [ref=e42]: White pieces nearest you.
          - generic [ref=e43]:
            - paragraph [ref=e44]: Tap a piece, then a square.
            - group [ref=e45]:
              - generic "Keyboard controls" [ref=e46] [cursor=pointer]
          - generic [ref=e48]:
            - generic [ref=e49]:
              - generic [ref=e50]: "8"
              - generic [ref=e51]: "7"
              - generic [ref=e52]: "6"
              - generic [ref=e53]: "5"
              - generic [ref=e54]: "4"
              - generic [ref=e55]: "3"
              - generic [ref=e56]: "2"
              - generic [ref=e57]: "1"
            - application "Chess board, white facing you" [ref=e59]:
              - status [ref=e60]
              - generic:
                - button "a8, Black rook"
                - button "b8, empty"
                - button "c8, Black bishop"
                - button "d8, Black queen"
                - button "e8, Black king"
                - button "f8, empty"
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
                - button "c6, Black knight"
                - button "d6, empty"
                - button "e6, empty"
                - button "f6, empty"
                - button "g6, empty"
                - button "h6, empty"
                - button "a5, empty"
                - button "b5, empty"
                - button "c5, Black bishop"
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
                - button "g4, empty"
                - button "h4, empty"
                - button "a3, empty"
                - button "b3, empty"
                - button "c3, empty"
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
                - button "b1, White knight"
                - button "c1, White bishop"
                - button "d1, White queen"
                - button "e1, White king"
                - button "f1, empty"
                - button "g1, empty"
                - button "h1, White rook"
            - generic [ref=e78]:
              - generic [ref=e79]: a
              - generic [ref=e80]: b
              - generic [ref=e81]: c
              - generic [ref=e82]: d
              - generic [ref=e83]: e
              - generic [ref=e84]: f
              - generic [ref=e85]: g
              - generic [ref=e86]: h
        - status [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]: "White: avery. Black: jordan_plays."
            - text: White to move.
        - generic [ref=e98]:
          - img "White" [ref=e99]:
            - generic [ref=e100]: ♔
          - generic "avery" [ref=e103]
          - generic [ref=e104]: Your move
      - region "Game record" [ref=e106]:
        - heading "Game record" [level=2] [ref=e109]
        - generic [ref=e110]:
          - list "Moves played" [ref=e112]:
            - listitem [ref=e113]:
              - generic [ref=e114]: "1"
              - generic [ref=e115]:
                - generic [ref=e117]: ♔
                - 'button "Move 1, White: e4" [ref=e118] [cursor=pointer]': e4
              - generic [ref=e119]:
                - generic [ref=e121]: ♚
                - 'button "Move 2, Black: e5" [ref=e122] [cursor=pointer]': e5
            - listitem [ref=e123]:
              - generic [ref=e124]: "2"
              - generic [ref=e125]:
                - generic [ref=e127]: ♔
                - 'button "Move 3, White: Nf3" [ref=e128] [cursor=pointer]': Nf3
              - generic [ref=e129]:
                - generic [ref=e131]: ♚
                - 'button "Move 4, Black: Nc6" [ref=e132] [cursor=pointer]': Nc6
            - listitem [ref=e133]:
              - generic [ref=e134]: "3"
              - generic [ref=e135]:
                - generic [ref=e137]: ♔
                - 'button "Move 5, White: Bc4" [ref=e138] [cursor=pointer]': Bc4
              - generic [ref=e139]:
                - generic [ref=e141]: ♚
                - 'button "Move 6, Black: Bc5" [ref=e142] [cursor=pointer]': Bc5
          - generic [ref=e143]:
            - generic [ref=e144]:
              - button "Go to the start" [ref=e145] [cursor=pointer]:
                - img [ref=e148]
              - button "Previous move" [ref=e151] [cursor=pointer]:
                - img [ref=e154]
              - button "Next move" [disabled] [ref=e156]:
                - img [ref=e159]
              - button "Return to current position" [ref=e161] [cursor=pointer]:
                - img [ref=e164]
            - button "Go to move" [ref=e167] [cursor=pointer]:
              - generic [ref=e169]:
                - paragraph [ref=e170]: Go to move
                - img [ref=e173]
        - generic [ref=e176]:
          - group "Game actions" [ref=e177]:
            - button "Offer draw" [ref=e178] [cursor=pointer]:
              - paragraph [ref=e181]: Offer draw
            - button "Resign game" [ref=e182] [cursor=pointer]:
              - paragraph [ref=e185]:
                - text: Resign
                - generic [ref=e186]: game
          - button "History and stats" [ref=e187] [cursor=pointer]:
            - paragraph [ref=e190]: History and stats
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