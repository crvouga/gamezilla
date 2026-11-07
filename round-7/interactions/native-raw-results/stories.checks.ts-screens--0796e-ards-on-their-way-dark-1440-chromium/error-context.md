# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--cards-on-their-way dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  35120 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/cards-on-their-way-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/cards-on-their-way-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 35120 pixels (ratio 0.03 of all image pixels) are different.
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
  - 35120 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Hearts" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - group "Hearts table" [ref=e30]:
            - region "South" [ref=e31]:
              - generic [ref=e37]:
                - generic [ref=e38]: avery
                - generic [ref=e39]:
                  - generic [ref=e41]: You
                  - generic [ref=e43]: South
              - generic [ref=e44]:
                - generic [ref=e45]: 13 cards
                - generic [ref=e46]: Score 0
                - generic [ref=e47]: Choosing
            - region "West" [ref=e48]:
              - generic [ref=e53]:
                - generic [ref=e54]: jordan_plays
                - generic [ref=e57]: West
              - generic [ref=e58]:
                - generic [ref=e59]: 13 cards
                - generic [ref=e60]: Score 0
                - generic [ref=e61]: Choosing
            - region "North" [ref=e62]:
              - generic [ref=e67]:
                - generic [ref=e68]: morgan
                - generic [ref=e71]: North
              - generic [ref=e72]:
                - generic [ref=e73]: 13 cards
                - generic [ref=e74]: Score 0
                - generic [ref=e75]: Choosing
            - region "East" [ref=e76]:
              - generic [ref=e81]:
                - generic [ref=e82]: robin_42
                - generic [ref=e85]: East
              - generic [ref=e86]:
                - generic [ref=e87]: 13 cards
                - generic [ref=e88]: Score 0
                - generic [ref=e89]: Choosing
            - paragraph [ref=e90]: Your cards are on their way.
          - toolbar "Your hand" [ref=e91]
          - status
        - status [ref=e93]:
          - generic [ref=e94]:
            - generic [ref=e95]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: Passing to the left
      - region "Game record" [ref=e98]:
        - generic [ref=e99]:
          - heading "Game record" [level=2] [ref=e101]
          - paragraph [ref=e102]: Passing to the left
        - generic [ref=e103]:
          - generic [ref=e104]:
            - generic [ref=e105]:
              - paragraph [ref=e106]: Deal 1
              - paragraph [ref=e107]: Pass left
            - generic [ref=e109]: Now
          - generic [ref=e111]:
            - paragraph [ref=e112]: Deal 2
            - paragraph [ref=e113]: Pass right
          - generic [ref=e115]:
            - paragraph [ref=e116]: Deal 3
            - paragraph [ref=e117]: Pass across
          - generic [ref=e119]:
            - paragraph [ref=e120]: Deal 4
            - paragraph [ref=e121]: No passing
        - generic [ref=e123]:
          - group "Game actions" [ref=e124]:
            - button "Resign game" [ref=e125] [cursor=pointer]:
              - paragraph [ref=e128]:
                - text: Resign
                - generic [ref=e129]: game
          - button "History and stats" [ref=e130] [cursor=pointer]:
            - paragraph [ref=e133]: History and stats
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