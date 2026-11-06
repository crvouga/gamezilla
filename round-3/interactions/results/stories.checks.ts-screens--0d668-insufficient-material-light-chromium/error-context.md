# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-chess-board--insufficient-material light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  826 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/insufficient-material-light.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/insufficient-material-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 826 pixels (ratio 0.01 of all image pixels) are different.
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
  - 826 pixels (ratio 0.01 of all image pixels) are different.

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
            - generic [ref=e48]: jordan_plays
          - generic [ref=e50]:
            - paragraph [ref=e51]: White pieces nearest you.
            - generic [ref=e53]:
              - generic [ref=e54]:
                - generic [ref=e55]: "8"
                - generic [ref=e56]: "7"
                - generic [ref=e57]: "6"
                - generic [ref=e58]: "5"
                - generic [ref=e59]: "4"
                - generic [ref=e60]: "3"
                - generic [ref=e61]: "2"
                - generic [ref=e62]: "1"
              - application "Chess board, white facing you" [ref=e64]:
                - status [ref=e65]
                - generic:
                  - button "a8, empty"
                  - button "b8, empty"
                  - button "c8, empty"
                  - button "d8, empty"
                  - button "e8, empty"
                  - button "f8, empty"
                  - button "g8, empty"
                  - button "h8, empty"
                  - button "a7, empty"
                  - button "b7, empty"
                  - button "c7, empty"
                  - button "d7, empty"
                  - button "e7, empty"
                  - button "f7, empty"
                  - button "g7, empty"
                  - button "h7, empty"
                  - button "a6, empty"
                  - button "b6, empty"
                  - button "c6, empty"
                  - button "d6, empty"
                  - button "e6, Black king"
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
                  - button "e4, empty"
                  - button "f4, empty"
                  - button "g4, empty"
                  - button "h4, empty"
                  - button "a3, empty"
                  - button "b3, empty"
                  - button "c3, empty"
                  - button "d3, White king"
                  - button "e3, empty"
                  - button "f3, empty"
                  - button "g3, empty"
                  - button "h3, empty"
                  - button "a2, empty"
                  - button "b2, empty"
                  - button "c2, empty"
                  - button "d2, empty"
                  - button "e2, empty"
                  - button "f2, empty"
                  - button "g2, empty"
                  - button "h2, empty"
                  - button "a1, empty"
                  - button "b1, empty"
                  - button "c1, empty"
                  - button "d1, empty"
                  - button "e1, empty"
                  - button "f1, empty"
                  - button "g1, empty"
                  - button "h1, empty"
              - generic [ref=e67]:
                - generic [ref=e68]: a
                - generic [ref=e69]: b
                - generic [ref=e70]: c
                - generic [ref=e71]: d
                - generic [ref=e72]: e
                - generic [ref=e73]: f
                - generic [ref=e74]: g
                - generic [ref=e75]: h
          - status [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e81]: "White: avery. Black: jordan_plays."
              - text: Neither side can checkmate.
          - generic [ref=e89]:
            - img "White" [ref=e90]:
              - generic [ref=e91]: ♔
            - generic [ref=e92]: avery
        - generic [ref=e93]:
          - generic [ref=e94]:
            - heading "Draw" [level=2] [ref=e96]
            - list "Standings" [ref=e97]:
              - listitem [ref=e98]:
                - generic [ref=e99]:
                  - generic [ref=e100]: 1st
                  - generic [ref=e103]: avery
              - listitem [ref=e104]:
                - generic [ref=e105]:
                  - generic [ref=e106]: 1st
                  - generic [ref=e109]: jordan_plays
          - generic [ref=e111]:
            - group "What next" [ref=e112]:
              - button "Rematch" [ref=e113] [cursor=pointer]:
                - paragraph [ref=e116]: Rematch
              - button "Change game" [ref=e117] [cursor=pointer]:
                - paragraph [ref=e120]: Change game
              - button "Review" [ref=e121] [cursor=pointer]:
                - paragraph [ref=e124]: Review
            - button "History and stats" [ref=e125] [cursor=pointer]:
              - generic [ref=e127]:
                - paragraph [ref=e128]: History and stats
                - img [ref=e131]
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