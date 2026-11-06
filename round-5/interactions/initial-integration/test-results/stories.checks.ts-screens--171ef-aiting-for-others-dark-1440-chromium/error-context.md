# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--passed-waiting-for-others dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  2938 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/passed-waiting-for-others-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/passed-waiting-for-others-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 2938 pixels (ratio 0.01 of all image pixels) are different.
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
  - 2938 pixels (ratio 0.01 of all image pixels) are different.

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
            - region "South (you)" [ref=e31]:
              - generic [ref=e37]:
                - generic [ref=e38]: avery
                - generic [ref=e39]:
                  - generic [ref=e41]: You
                  - generic [ref=e43]: Chosen
                  - generic [ref=e45]: South
              - generic [ref=e46]:
                - generic [ref=e47]: 13 cards
                - generic [ref=e48]: Score 0
                - generic [ref=e49]: Passed
            - region "West" [ref=e50]:
              - generic [ref=e55]:
                - generic [ref=e56]: jordan_plays
                - generic [ref=e59]: West
              - generic [ref=e60]:
                - generic [ref=e61]: 13 cards
                - generic [ref=e62]: Score 0
                - generic [ref=e63]: Choosing
            - region "North" [ref=e64]:
              - generic [ref=e69]:
                - generic [ref=e70]: morgan
                - generic [ref=e71]:
                  - generic [ref=e73]: Chosen
                  - generic [ref=e75]: North
              - generic [ref=e76]:
                - generic [ref=e77]: 13 cards
                - generic [ref=e78]: Score 0
                - generic [ref=e79]: Passed
            - region "East" [ref=e80]:
              - generic [ref=e85]:
                - generic [ref=e86]: robin_42
                - generic [ref=e89]: East
              - generic [ref=e90]:
                - generic [ref=e91]: 13 cards
                - generic [ref=e92]: Score 0
                - generic [ref=e93]: Choosing
            - generic [ref=e94]:
              - generic [ref=e95]: Passed to the left
              - generic [ref=e96]:
                - generic [ref=e98]:
                  - generic [ref=e99]: 6 ♣
                  - generic [ref=e100]: ♣
                  - generic [ref=e101]: clubs
                - generic [ref=e103]:
                  - generic [ref=e104]: 4 ♠
                  - generic [ref=e105]: ♠
                  - generic [ref=e106]: spades
                - generic [ref=e108]:
                  - generic [ref=e109]: J ♥
                  - generic [ref=e110]: ♥
                  - generic [ref=e111]: hearts
            - paragraph [ref=e112]: Your cards are chosen. Waiting for every player to pass. South and North have passed.
          - toolbar "Your hand" [ref=e113]:
            - button "6 clubs, Six of clubs" [disabled] [pressed] [ref=e114]:
              - generic [ref=e115]: 6 ♣
              - generic [ref=e116]: ♣
              - generic [ref=e117]: clubs
            - button "A clubs, Ace of clubs" [disabled] [ref=e118]:
              - generic [ref=e119]: A ♣
              - generic [ref=e120]: ♣
              - generic [ref=e121]: clubs
            - button "10 diamonds, Ten of diamonds" [disabled] [ref=e122]:
              - generic [ref=e123]: 10 ♦
              - generic [ref=e124]: ♦
              - generic [ref=e125]: diamonds
            - button "3 spades, Three of spades" [disabled] [ref=e126]:
              - generic [ref=e127]: 3 ♠
              - generic [ref=e128]: ♠
              - generic [ref=e129]: spades
            - button "4 spades, Four of spades" [disabled] [pressed] [ref=e130]:
              - generic [ref=e131]: 4 ♠
              - generic [ref=e132]: ♠
              - generic [ref=e133]: spades
            - button "10 spades, Ten of spades" [disabled] [ref=e134]:
              - generic [ref=e135]: 10 ♠
              - generic [ref=e136]: ♠
              - generic [ref=e137]: spades
            - button "2 hearts, Two of hearts" [disabled] [ref=e138]:
              - generic [ref=e139]: 2 ♥
              - generic [ref=e140]: ♥
              - generic [ref=e141]: hearts
            - button "4 hearts, Four of hearts" [disabled] [ref=e142]:
              - generic [ref=e143]: 4 ♥
              - generic [ref=e144]: ♥
              - generic [ref=e145]: hearts
            - button "5 hearts, Five of hearts" [disabled] [ref=e146]:
              - generic [ref=e147]: 5 ♥
              - generic [ref=e148]: ♥
              - generic [ref=e149]: hearts
            - button "7 hearts, Seven of hearts" [disabled] [ref=e150]:
              - generic [ref=e151]: 7 ♥
              - generic [ref=e152]: ♥
              - generic [ref=e153]: hearts
            - button "8 hearts, Eight of hearts" [disabled] [ref=e154]:
              - generic [ref=e155]: 8 ♥
              - generic [ref=e156]: ♥
              - generic [ref=e157]: hearts
            - button "J hearts, Jack of hearts" [disabled] [pressed] [ref=e158]:
              - generic [ref=e159]: J ♥
              - generic [ref=e160]: ♥
              - generic [ref=e161]: hearts
            - button "Q hearts, Queen of hearts" [disabled] [ref=e162]:
              - generic [ref=e163]: Q ♥
              - generic [ref=e164]: ♥
              - generic [ref=e165]: hearts
          - status
        - status [ref=e167]:
          - generic [ref=e168]:
            - generic [ref=e169]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: Passing to the left
      - region "Game record" [ref=e172]:
        - generic [ref=e173]:
          - heading "Game record" [level=2] [ref=e175]
          - paragraph [ref=e176]: Passing to the left
        - generic [ref=e177]:
          - generic [ref=e178]:
            - generic [ref=e179]:
              - paragraph [ref=e180]: Deal 1
              - paragraph [ref=e181]: Pass left
            - generic [ref=e183]: Now
          - generic [ref=e185]:
            - paragraph [ref=e186]: Deal 2
            - paragraph [ref=e187]: Pass right
          - generic [ref=e189]:
            - paragraph [ref=e190]: Deal 3
            - paragraph [ref=e191]: Pass across
          - generic [ref=e193]:
            - paragraph [ref=e194]: Deal 4
            - paragraph [ref=e195]: No passing
        - generic [ref=e197]:
          - group "Game actions" [ref=e198]:
            - button "Resign game" [ref=e199] [cursor=pointer]:
              - paragraph [ref=e202]:
                - text: Resign
                - generic [ref=e203]: game
          - button "History and stats" [ref=e204] [cursor=pointer]:
            - paragraph [ref=e207]: History and stats
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