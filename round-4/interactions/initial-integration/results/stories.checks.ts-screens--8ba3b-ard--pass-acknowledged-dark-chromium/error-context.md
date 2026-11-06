# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--pass-acknowledged dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  46348 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-acknowledged-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-acknowledged-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 46348 pixels (ratio 0.15 of all image pixels) are different.
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
  - 46348 pixels (ratio 0.15 of all image pixels) are different.

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
              - region "South (you)" [ref=e43]:
                - generic [ref=e49]:
                  - generic [ref=e50]: avery
                  - generic [ref=e51]:
                    - generic [ref=e53]: You
                    - generic [ref=e55]: Chosen
                    - generic [ref=e57]: South
                - generic [ref=e58]:
                  - generic [ref=e59]: 13 cards
                  - generic [ref=e60]: Score 0
                  - generic [ref=e61]: Passed
              - region "West" [ref=e62]:
                - generic [ref=e67]:
                  - generic [ref=e68]: jordan_plays
                  - generic [ref=e71]: West
                - generic [ref=e72]:
                  - generic [ref=e73]: 13 cards
                  - generic [ref=e74]: Score 0
                  - generic [ref=e75]: Choosing
              - region "North" [ref=e76]:
                - generic [ref=e81]:
                  - generic [ref=e82]: morgan
                  - generic [ref=e85]: North
                - generic [ref=e86]:
                  - generic [ref=e87]: 13 cards
                  - generic [ref=e88]: Score 0
                  - generic [ref=e89]: Choosing
              - region "East" [ref=e90]:
                - generic [ref=e95]:
                  - generic [ref=e96]: robin_42
                  - generic [ref=e99]: East
                - generic [ref=e100]:
                  - generic [ref=e101]: 13 cards
                  - generic [ref=e102]: Score 0
                  - generic [ref=e103]: Choosing
              - generic [ref=e104]:
                - generic [ref=e105]: Passed to the left
                - generic [ref=e106]:
                  - generic [ref=e108]:
                    - generic [ref=e109]: 6 ♣
                    - generic [ref=e110]: ♣
                    - generic [ref=e111]: clubs
                  - generic [ref=e113]:
                    - generic [ref=e114]: 4 ♠
                    - generic [ref=e115]: ♠
                    - generic [ref=e116]: spades
                  - generic [ref=e118]:
                    - generic [ref=e119]: J ♥
                    - generic [ref=e120]: ♥
                    - generic [ref=e121]: hearts
              - paragraph [ref=e122]: Your cards are chosen. Waiting for every player to pass. South has passed.
            - toolbar "Your hand" [ref=e123]:
              - button "6 clubs, Six of clubs" [disabled] [pressed] [ref=e124]:
                - generic [ref=e125]: 6 ♣
                - generic [ref=e126]: ♣
                - generic [ref=e127]: clubs
              - button "A clubs, Ace of clubs" [disabled] [ref=e128]:
                - generic [ref=e129]: A ♣
                - generic [ref=e130]: ♣
                - generic [ref=e131]: clubs
              - button "10 diamonds, Ten of diamonds" [disabled] [ref=e132]:
                - generic [ref=e133]: 10 ♦
                - generic [ref=e134]: ♦
                - generic [ref=e135]: diamonds
              - button "3 spades, Three of spades" [disabled] [ref=e136]:
                - generic [ref=e137]: 3 ♠
                - generic [ref=e138]: ♠
                - generic [ref=e139]: spades
              - button "4 spades, Four of spades" [disabled] [pressed] [ref=e140]:
                - generic [ref=e141]: 4 ♠
                - generic [ref=e142]: ♠
                - generic [ref=e143]: spades
              - button "10 spades, Ten of spades" [disabled] [ref=e144]:
                - generic [ref=e145]: 10 ♠
                - generic [ref=e146]: ♠
                - generic [ref=e147]: spades
              - button "2 hearts, Two of hearts" [disabled] [ref=e148]:
                - generic [ref=e149]: 2 ♥
                - generic [ref=e150]: ♥
                - generic [ref=e151]: hearts
              - button "4 hearts, Four of hearts" [disabled] [ref=e152]:
                - generic [ref=e153]: 4 ♥
                - generic [ref=e154]: ♥
                - generic [ref=e155]: hearts
              - button "5 hearts, Five of hearts" [disabled] [ref=e156]:
                - generic [ref=e157]: 5 ♥
                - generic [ref=e158]: ♥
                - generic [ref=e159]: hearts
              - button "7 hearts, Seven of hearts" [disabled] [ref=e160]:
                - generic [ref=e161]: 7 ♥
                - generic [ref=e162]: ♥
                - generic [ref=e163]: hearts
              - button "8 hearts, Eight of hearts" [disabled] [ref=e164]:
                - generic [ref=e165]: 8 ♥
                - generic [ref=e166]: ♥
                - generic [ref=e167]: hearts
              - button "J hearts, Jack of hearts" [disabled] [pressed] [ref=e168]:
                - generic [ref=e169]: J ♥
                - generic [ref=e170]: ♥
                - generic [ref=e171]: hearts
              - button "Q hearts, Queen of hearts" [disabled] [ref=e172]:
                - generic [ref=e173]: Q ♥
                - generic [ref=e174]: ♥
                - generic [ref=e175]: hearts
            - status
          - status [ref=e177]:
            - generic [ref=e178]:
              - generic [ref=e179]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: Passing to the left
        - generic [ref=e182]:
          - group "Game actions" [ref=e183]:
            - button "Resign game" [ref=e184] [cursor=pointer]:
              - paragraph [ref=e187]:
                - text: Resign
                - generic [ref=e188]: game
          - button "History and stats" [ref=e189] [cursor=pointer]:
            - generic [ref=e191]:
              - paragraph [ref=e192]: History and stats
              - img [ref=e195]
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