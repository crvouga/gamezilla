# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--pass-three-cards light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  34532 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-three-cards-light.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-three-cards-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 34532 pixels (ratio 0.11 of all image pixels) are different.
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
  - 34532 pixels (ratio 0.11 of all image pixels) are different.

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
                    - generic [ref=e55]: South
                - generic [ref=e56]:
                  - generic [ref=e57]: 13 cards
                  - generic [ref=e58]: Score 0
                  - generic [ref=e59]: Choosing
              - region "West" [ref=e60]:
                - generic [ref=e65]:
                  - generic [ref=e66]: jordan_plays
                  - generic [ref=e69]: West
                - generic [ref=e70]:
                  - generic [ref=e71]: 13 cards
                  - generic [ref=e72]: ·Score 0
                  - generic [ref=e73]: Choosing
              - region "North" [ref=e74]:
                - generic [ref=e79]:
                  - generic [ref=e80]: morgan
                  - generic [ref=e83]: North
                - generic [ref=e84]:
                  - generic [ref=e85]: 13 cards
                  - generic [ref=e86]: Score 0
                  - generic [ref=e87]: Choosing
              - region "East" [ref=e88]:
                - generic [ref=e93]:
                  - generic [ref=e94]: robin_42
                  - generic [ref=e97]: East
                - generic [ref=e98]:
                  - generic [ref=e99]: 13 cards
                  - generic [ref=e100]: ·Score 0
                  - generic [ref=e101]: Choosing
              - generic [ref=e102]:
                - generic [ref=e103]: Passing to the left
                - generic [ref=e104]:
                  - generic [ref=e106]:
                    - generic [ref=e107]: 6 ♣
                    - generic [ref=e108]: ♣
                    - generic [ref=e109]: clubs
                  - generic [ref=e111]:
                    - generic [ref=e112]: 4 ♠
                    - generic [ref=e113]: ♠
                    - generic [ref=e114]: spades
                  - generic [ref=e116]:
                    - generic [ref=e117]: J ♥
                    - generic [ref=e118]: ♥
                    - generic [ref=e119]: hearts
              - paragraph [ref=e120]: Pass three cards to the left. Nobody has passed yet.
            - toolbar "Your hand" [ref=e121]:
              - button "6 clubs, Six of clubs" [pressed] [ref=e122] [cursor=pointer]:
                - generic [ref=e123]: 6 ♣
                - generic [ref=e124]: ♣
                - generic [ref=e125]: clubs
              - button "A clubs, Ace of clubs" [ref=e126] [cursor=pointer]:
                - generic [ref=e127]: A ♣
                - generic [ref=e128]: ♣
                - generic [ref=e129]: clubs
              - button "10 diamonds, Ten of diamonds" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 10 ♦
                - generic [ref=e132]: ♦
                - generic [ref=e133]: diamonds
              - button "3 spades, Three of spades" [ref=e134] [cursor=pointer]:
                - generic [ref=e135]: 3 ♠
                - generic [ref=e136]: ♠
                - generic [ref=e137]: spades
              - button "4 spades, Four of spades" [pressed] [ref=e138] [cursor=pointer]:
                - generic [ref=e139]: 4 ♠
                - generic [ref=e140]: ♠
                - generic [ref=e141]: spades
              - button "10 spades, Ten of spades" [ref=e142] [cursor=pointer]:
                - generic [ref=e143]: 10 ♠
                - generic [ref=e144]: ♠
                - generic [ref=e145]: spades
              - button "2 hearts, Two of hearts" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: 2 ♥
                - generic [ref=e148]: ♥
                - generic [ref=e149]: hearts
              - button "4 hearts, Four of hearts" [ref=e150] [cursor=pointer]:
                - generic [ref=e151]: 4 ♥
                - generic [ref=e152]: ♥
                - generic [ref=e153]: hearts
              - button "5 hearts, Five of hearts" [ref=e154] [cursor=pointer]:
                - generic [ref=e155]: 5 ♥
                - generic [ref=e156]: ♥
                - generic [ref=e157]: hearts
              - button "7 hearts, Seven of hearts" [ref=e158] [cursor=pointer]:
                - generic [ref=e159]: 7 ♥
                - generic [ref=e160]: ♥
                - generic [ref=e161]: hearts
              - button "8 hearts, Eight of hearts" [ref=e162] [cursor=pointer]:
                - generic [ref=e163]: 8 ♥
                - generic [ref=e164]: ♥
                - generic [ref=e165]: hearts
              - button "J hearts, Jack of hearts" [active] [pressed] [ref=e166] [cursor=pointer]:
                - generic [ref=e167]: J ♥
                - generic [ref=e168]: ♥
                - generic [ref=e169]: hearts
              - button "Q hearts, Queen of hearts" [ref=e170] [cursor=pointer]:
                - generic [ref=e171]: Q ♥
                - generic [ref=e172]: ♥
                - generic [ref=e173]: hearts
            - status
            - generic [ref=e174]:
              - paragraph [ref=e175]: 3 of 3 chosen
              - button "Pass left" [ref=e176] [cursor=pointer]:
                - paragraph [ref=e179]: Pass left
          - status [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: Passing to the left
        - generic [ref=e186]:
          - group "Game actions" [ref=e187]:
            - button "Resign game" [ref=e188] [cursor=pointer]:
              - paragraph [ref=e191]:
                - text: Resign
                - generic [ref=e192]: game
          - button "History and stats" [ref=e193] [cursor=pointer]:
            - generic [ref=e195]:
              - paragraph [ref=e196]: History and stats
              - img [ref=e199]
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