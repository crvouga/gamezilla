# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-chess-board--stalemate light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1114 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/stalemate-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/chess-root-client-ts/src/baselines/chromium/screens-games-chess-board/stalemate-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1114 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1114 pixels (ratio 0.01 of all image pixels) are different.

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
          - generic [ref=e37]: jordan_plays
        - generic [ref=e39]:
          - paragraph [ref=e40]: White pieces nearest you.
          - generic [ref=e42]:
            - generic [ref=e43]:
              - generic [ref=e44]: "8"
              - generic [ref=e45]: "7"
              - generic [ref=e46]: "6"
              - generic [ref=e47]: "5"
              - generic [ref=e48]: "4"
              - generic [ref=e49]: "3"
              - generic [ref=e50]: "2"
              - generic [ref=e51]: "1"
            - application "Chess board, white facing you" [ref=e53]:
              - status [ref=e54]
              - generic:
                - button "a8, empty"
                - button "b8, empty"
                - button "c8, empty"
                - button "d8, empty"
                - button "e8, empty"
                - button "f8, empty"
                - button "g8, empty"
                - button "h8, Black king"
                - button "a7, empty"
                - button "b7, empty"
                - button "c7, empty"
                - button "d7, empty"
                - button "e7, empty"
                - button "f7, White queen"
                - button "g7, empty"
                - button "h7, empty"
                - button "a6, empty"
                - button "b6, empty"
                - button "c6, empty"
                - button "d6, empty"
                - button "e6, empty"
                - button "f6, empty"
                - button "g6, White king"
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
                - button "d3, empty"
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
            - generic [ref=e56]:
              - generic [ref=e57]: a
              - generic [ref=e58]: b
              - generic [ref=e59]: c
              - generic [ref=e60]: d
              - generic [ref=e61]: e
              - generic [ref=e62]: f
              - generic [ref=e63]: g
              - generic [ref=e64]: h
        - status [ref=e66]:
          - generic [ref=e67]:
            - generic [ref=e68]: "White: avery. Black: jordan_plays."
            - text: By stalemate.
        - generic [ref=e76]:
          - img "White" [ref=e77]:
            - generic [ref=e78]: ♔
          - generic [ref=e79]: avery
      - generic [ref=e81]:
        - heading "Draw" [level=2] [ref=e83]
        - list "Standings" [ref=e84]:
          - listitem [ref=e85]:
            - generic [ref=e86]:
              - generic [ref=e87]: 1st
              - generic [ref=e90]: avery
          - listitem [ref=e91]:
            - generic [ref=e92]:
              - generic [ref=e93]: 1st
              - generic [ref=e96]: jordan_plays
      - region "Game record" [ref=e99]:
        - generic [ref=e100]:
          - heading "Game record" [level=2] [ref=e102]
          - paragraph [ref=e103]: By stalemate.
        - generic [ref=e105]:
          - group "What next" [ref=e106]:
            - button "Rematch" [ref=e107] [cursor=pointer]:
              - paragraph [ref=e110]: Rematch
            - button "Change game" [ref=e111] [cursor=pointer]:
              - paragraph [ref=e114]: Change game
            - button "Review" [ref=e115] [cursor=pointer]:
              - paragraph [ref=e118]: Review
          - button "History and stats" [ref=e119] [cursor=pointer]:
            - paragraph [ref=e122]: History and stats
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