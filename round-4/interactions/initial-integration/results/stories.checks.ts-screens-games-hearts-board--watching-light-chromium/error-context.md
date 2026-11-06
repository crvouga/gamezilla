# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--watching light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  60576 pixels (ratio 0.19 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/watching-light.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/watching-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 60576 pixels (ratio 0.19 of all image pixels) are different.
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
  - 60576 pixels (ratio 0.19 of all image pixels) are different.

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
        - paragraph [ref=e24]: North to play.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - group "Hearts table" [ref=e42]:
              - region "South" [ref=e43]:
                - generic [ref=e48]:
                  - generic [ref=e49]: avery
                  - generic [ref=e52]: South
                - generic [ref=e53]:
                  - generic [ref=e54]: 8 cards
                  - generic [ref=e55]: Score 12
                  - generic [ref=e56]: Taken 0
              - region "West" [ref=e57]:
                - generic [ref=e62]:
                  - generic [ref=e63]: jordan_plays
                  - generic [ref=e66]: West
                - generic [ref=e67]:
                  - generic [ref=e68]: 8 cards
                  - generic [ref=e69]: Score 30
                  - generic [ref=e70]: Taken 0
              - region "North" [ref=e71]:
                - generic [ref=e76]:
                  - generic [ref=e77]: morgan
                  - generic [ref=e80]: North
                - generic [ref=e81]:
                  - generic [ref=e82]: 9 cards
                  - generic [ref=e83]: Score 8
                  - generic [ref=e84]: Taken 0
              - region "East" [ref=e85]:
                - generic [ref=e90]:
                  - generic [ref=e91]: robin_42
                  - generic [ref=e94]: East
                - generic [ref=e95]:
                  - generic [ref=e96]: 9 cards
                  - generic [ref=e97]: Score 28
                  - generic [ref=e98]: Taken 0
              - generic [ref=e99]:
                - group "South" [ref=e100]:
                  - img "3 spades, Three of spades" [ref=e101]:
                    - generic [ref=e102]: 3 ♠
                    - generic [ref=e103]: ♠
                    - generic [ref=e104]: spades
                - group "West" [ref=e105]:
                  - img "5 spades, Five of spades" [ref=e106]:
                    - generic [ref=e107]: 5 ♠
                    - generic [ref=e108]: ♠
                    - generic [ref=e109]: spades
                - group "North" [ref=e110]
                - group "East" [ref=e111]
              - paragraph [ref=e112]: North to play.
            - toolbar "Your hand" [ref=e113]
            - status
          - status [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: North to play.
        - button "History and stats" [ref=e121] [cursor=pointer]:
          - generic [ref=e123]:
            - paragraph [ref=e124]: History and stats
            - img [ref=e127]
      - generic [ref=e129]:
        - img [ref=e132]
        - generic [ref=e135]:
          - paragraph [ref=e136]: You're watching
          - paragraph [ref=e137]: Moves appear as they are played.
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