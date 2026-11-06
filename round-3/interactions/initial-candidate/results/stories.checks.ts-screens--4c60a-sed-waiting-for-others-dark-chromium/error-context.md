# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--passed-waiting-for-others dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  43069 pixels (ratio 0.14 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/passed-waiting-for-others-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/passed-waiting-for-others-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 43069 pixels (ratio 0.14 of all image pixels) are different.
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
  - 43069 pixels (ratio 0.14 of all image pixels) are different.

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
                  - generic [ref=e74]: ·Score 0
                  - generic [ref=e75]: Choosing
              - region "North" [ref=e76]:
                - generic [ref=e81]:
                  - generic [ref=e82]: morgan
                  - generic [ref=e83]:
                    - generic [ref=e85]: Chosen
                    - generic [ref=e87]: North
                - generic [ref=e88]:
                  - generic [ref=e89]: 13 cards
                  - generic [ref=e90]: Score 0
                  - generic [ref=e91]: Passed
              - region "East" [ref=e92]:
                - generic [ref=e97]:
                  - generic [ref=e98]: robin_42
                  - generic [ref=e101]: East
                - generic [ref=e102]:
                  - generic [ref=e103]: 13 cards
                  - generic [ref=e104]: ·Score 0
                  - generic [ref=e105]: Choosing
              - generic [ref=e106]:
                - generic [ref=e107]: Passed to the left
                - generic [ref=e108]:
                  - generic [ref=e110]:
                    - generic [ref=e111]: 6 ♣
                    - generic [ref=e112]: ♣
                    - generic [ref=e113]: clubs
                  - generic [ref=e115]:
                    - generic [ref=e116]: 4 ♠
                    - generic [ref=e117]: ♠
                    - generic [ref=e118]: spades
                  - generic [ref=e120]:
                    - generic [ref=e121]: J ♥
                    - generic [ref=e122]: ♥
                    - generic [ref=e123]: hearts
              - paragraph [ref=e124]: Your cards are chosen. Waiting for every player to pass. South and North have passed.
            - toolbar "Your hand" [ref=e125]:
              - button "6 clubs, Six of clubs" [disabled] [pressed] [ref=e126]:
                - generic [ref=e127]: 6 ♣
                - generic [ref=e128]: ♣
                - generic [ref=e129]: clubs
              - button "A clubs, Ace of clubs" [disabled] [ref=e130]:
                - generic [ref=e131]: A ♣
                - generic [ref=e132]: ♣
                - generic [ref=e133]: clubs
              - button "10 diamonds, Ten of diamonds" [disabled] [ref=e134]:
                - generic [ref=e135]: 10 ♦
                - generic [ref=e136]: ♦
                - generic [ref=e137]: diamonds
              - button "3 spades, Three of spades" [disabled] [ref=e138]:
                - generic [ref=e139]: 3 ♠
                - generic [ref=e140]: ♠
                - generic [ref=e141]: spades
              - button "4 spades, Four of spades" [disabled] [pressed] [ref=e142]:
                - generic [ref=e143]: 4 ♠
                - generic [ref=e144]: ♠
                - generic [ref=e145]: spades
              - button "10 spades, Ten of spades" [disabled] [ref=e146]:
                - generic [ref=e147]: 10 ♠
                - generic [ref=e148]: ♠
                - generic [ref=e149]: spades
              - button "2 hearts, Two of hearts" [disabled] [ref=e150]:
                - generic [ref=e151]: 2 ♥
                - generic [ref=e152]: ♥
                - generic [ref=e153]: hearts
              - button "4 hearts, Four of hearts" [disabled] [ref=e154]:
                - generic [ref=e155]: 4 ♥
                - generic [ref=e156]: ♥
                - generic [ref=e157]: hearts
              - button "5 hearts, Five of hearts" [disabled] [ref=e158]:
                - generic [ref=e159]: 5 ♥
                - generic [ref=e160]: ♥
                - generic [ref=e161]: hearts
              - button "7 hearts, Seven of hearts" [disabled] [ref=e162]:
                - generic [ref=e163]: 7 ♥
                - generic [ref=e164]: ♥
                - generic [ref=e165]: hearts
              - button "8 hearts, Eight of hearts" [disabled] [ref=e166]:
                - generic [ref=e167]: 8 ♥
                - generic [ref=e168]: ♥
                - generic [ref=e169]: hearts
              - button "J hearts, Jack of hearts" [disabled] [pressed] [ref=e170]:
                - generic [ref=e171]: J ♥
                - generic [ref=e172]: ♥
                - generic [ref=e173]: hearts
              - button "Q hearts, Queen of hearts" [disabled] [ref=e174]:
                - generic [ref=e175]: Q ♥
                - generic [ref=e176]: ♥
                - generic [ref=e177]: hearts
            - status
          - status [ref=e179]:
            - generic [ref=e180]:
              - generic [ref=e181]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: Passing to the left
        - generic [ref=e184]:
          - group "Game actions" [ref=e185]:
            - button "Resign game" [ref=e186] [cursor=pointer]:
              - paragraph [ref=e189]:
                - text: Resign
                - generic [ref=e190]: game
          - button "History and stats" [ref=e191] [cursor=pointer]:
            - generic [ref=e193]:
              - paragraph [ref=e194]: History and stats
              - img [ref=e197]
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