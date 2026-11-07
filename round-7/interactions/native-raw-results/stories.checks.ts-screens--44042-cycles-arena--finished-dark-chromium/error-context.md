# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--finished dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  33010 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/finished-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/finished-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 33010 pixels (ratio 0.11 of all image pixels) are different.
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
  - 33010 pixels (ratio 0.11 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Light Cycles Trio" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - heading "jordan_plays wins" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e39]:
        - generic [ref=e41]:
          - list "Players" [ref=e43]:
            - generic "avery" [ref=e44]:
              - listitem [ref=e45]:
                - generic [ref=e48]:
                  - generic [ref=e49]: avery
                  - generic [ref=e50]:
                    - generic [ref=e52]: C
                    - generic [ref=e53]: Comet wins 0
                    - generic [ref=e55]: You
            - generic "jordan_plays" [ref=e56]:
              - listitem [ref=e57]:
                - generic [ref=e59]:
                  - generic [ref=e60]: jordan_plays
                  - generic [ref=e61]:
                    - generic [ref=e63]: E
                    - generic [ref=e64]: Ember wins 1
            - generic "morgan" [ref=e65]:
              - listitem [ref=e66]:
                - generic [ref=e68]:
                  - generic [ref=e69]: morgan
                  - generic [ref=e70]:
                    - generic [ref=e72]: "N"
                    - generic [ref=e73]: Nova wins 0
          - generic [ref=e75]:
            - generic [ref=e76]: Comet 0Ember 1Nova 0Round 1 · first to 1
            - status [ref=e77]: Ember wins the game.
            - application "Light Cycles arena" [ref=e78]:
              - img [ref=e79]:
                - generic [ref=e86]:
                  - generic: C
                - generic [ref=e88]:
                  - generic: E
                - generic [ref=e91]:
                  - generic: "N"
              - status
          - status [ref=e100]:
            - generic [ref=e101]:
              - generic [ref=e102]: "Comet: avery. Ember: jordan_plays. Nova: morgan."
              - text: The target score was reached.
        - generic [ref=e103]:
          - list "Standings" [ref=e105]:
            - listitem [ref=e106]:
              - generic [ref=e107]:
                - generic [ref=e108]: 1st
                - generic [ref=e111]: jordan_plays
                - generic [ref=e112]:
                  - generic [ref=e113]: Round wins
                  - text: "1"
            - listitem [ref=e114]:
              - generic [ref=e115]:
                - generic [ref=e116]: 2nd
                - generic [ref=e119]: avery
                - generic [ref=e120]:
                  - generic [ref=e121]: Round wins
                  - text: "0"
            - listitem [ref=e122]:
              - generic [ref=e123]:
                - generic [ref=e124]: 2nd
                - generic [ref=e127]: morgan
                - generic [ref=e128]:
                  - generic [ref=e129]: Round wins
                  - text: "0"
          - button "History and stats" [ref=e132] [cursor=pointer]:
            - generic [ref=e134]:
              - paragraph [ref=e135]: History and stats
              - img [ref=e138]
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