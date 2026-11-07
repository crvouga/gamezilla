# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--watching light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  50136 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/watching-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/watching-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 50136 pixels (ratio 0.05 of all image pixels) are different.
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
  - 50136 pixels (ratio 0.05 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e27]:
          - generic [ref=e29]:
            - group "Hearts table" [ref=e30]:
              - region "South" [ref=e31]:
                - generic [ref=e36]:
                  - generic [ref=e37]: avery
                  - generic [ref=e40]: South
                - generic [ref=e41]:
                  - generic [ref=e42]: 8 cards
                  - generic [ref=e43]: Score 12
                  - generic [ref=e44]: Taken 0
              - region "West" [ref=e45]:
                - generic [ref=e50]:
                  - generic [ref=e51]: jordan_plays
                  - generic [ref=e54]: West
                - generic [ref=e55]:
                  - generic [ref=e56]: 8 cards
                  - generic [ref=e57]: Score 30
                  - generic [ref=e58]: Taken 0
              - region "North" [ref=e59]:
                - generic [ref=e64]:
                  - generic [ref=e65]: morgan
                  - generic [ref=e68]: North
                - generic [ref=e69]:
                  - generic [ref=e70]: 9 cards
                  - generic [ref=e71]: Score 8
                  - generic [ref=e72]: Taken 0
              - region "East" [ref=e73]:
                - generic [ref=e78]:
                  - generic [ref=e79]: robin_42
                  - generic [ref=e82]: East
                - generic [ref=e83]:
                  - generic [ref=e84]: 9 cards
                  - generic [ref=e85]: Score 28
                  - generic [ref=e86]: Taken 0
              - generic [ref=e87]:
                - group "South" [ref=e88]:
                  - img "3 spades, Three of spades" [ref=e89]:
                    - generic [ref=e90]: 3 ♠
                    - generic [ref=e91]: ♠
                    - generic [ref=e92]: spades
                - group "West" [ref=e93]:
                  - img "5 spades, Five of spades" [ref=e94]:
                    - generic [ref=e95]: 5 ♠
                    - generic [ref=e96]: ♠
                    - generic [ref=e97]: spades
                - group "North" [ref=e98]
                - group "East" [ref=e99]
              - paragraph [ref=e100]: morgan to play.
            - toolbar "Your hand" [ref=e101]
            - status
          - status [ref=e103]:
            - generic [ref=e104]:
              - generic [ref=e105]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: morgan to play.
        - region "Game record" [ref=e108]:
          - generic [ref=e109]:
            - heading "Game record" [level=2] [ref=e111]
            - paragraph [ref=e112]: morgan to play.
          - generic [ref=e113]:
            - generic [ref=e115]:
              - paragraph [ref=e116]: Deal 1
              - paragraph [ref=e117]: Pass left
            - generic [ref=e119]:
              - paragraph [ref=e120]: Deal 2
              - paragraph [ref=e121]: Pass right
            - generic [ref=e123]:
              - paragraph [ref=e124]: Deal 3
              - paragraph [ref=e125]: Pass across
            - generic [ref=e126]:
              - generic [ref=e127]:
                - paragraph [ref=e128]: Deal 4
                - paragraph [ref=e129]: No passing
              - generic [ref=e131]: Now
          - button "History and stats" [ref=e134] [cursor=pointer]:
            - paragraph [ref=e137]: History and stats
      - generic [ref=e138]:
        - img [ref=e141]
        - generic [ref=e144]:
          - paragraph [ref=e145]: You're watching
          - paragraph [ref=e146]: Moves appear as they are played.
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