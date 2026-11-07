# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--cards-on-their-way light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  39221 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/cards-on-their-way-light.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/cards-on-their-way-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 39221 pixels (ratio 0.12 of all image pixels) are different.
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
  - 39221 pixels (ratio 0.12 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Hearts" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Passing to the left
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - group "Hearts table" [ref=e42]:
              - region "South" [ref=e43]:
                - generic [ref=e47]:
                  - generic [ref=e48]: avery
                  - generic [ref=e49]:
                    - generic [ref=e51]: You
                    - generic [ref=e53]: South
                - generic [ref=e54]:
                  - generic [ref=e55]: 13 cards
                  - generic [ref=e56]: Score 0
                  - generic [ref=e57]: Choosing
              - region "West" [ref=e58]:
                - generic [ref=e61]:
                  - generic [ref=e62]: jordan_plays
                  - generic [ref=e65]: West
                - generic [ref=e66]:
                  - generic [ref=e67]: 13 cards
                  - generic [ref=e68]: Score 0
                  - generic [ref=e69]: Choosing
              - region "North" [ref=e70]:
                - generic [ref=e73]:
                  - generic [ref=e74]: morgan
                  - generic [ref=e77]: North
                - generic [ref=e78]:
                  - generic [ref=e79]: 13 cards
                  - generic [ref=e80]: Score 0
                  - generic [ref=e81]: Choosing
              - region "East" [ref=e82]:
                - generic [ref=e85]:
                  - generic [ref=e86]: robin_42
                  - generic [ref=e89]: East
                - generic [ref=e90]:
                  - generic [ref=e91]: 13 cards
                  - generic [ref=e92]: Score 0
                  - generic [ref=e93]: Choosing
              - paragraph [ref=e94]: Your cards are on their way.
            - toolbar "Your hand" [ref=e95]
            - status
          - status [ref=e97]:
            - generic [ref=e98]:
              - generic [ref=e99]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: Passing to the left
        - generic [ref=e102]:
          - group "Game actions" [ref=e103]:
            - button "Resign game" [ref=e104] [cursor=pointer]:
              - paragraph [ref=e107]:
                - text: Resign
                - generic [ref=e108]: game
          - button "History and stats" [ref=e109] [cursor=pointer]:
            - generic [ref=e111]:
              - paragraph [ref=e112]: History and stats
              - img [ref=e115]
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