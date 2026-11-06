# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--pass-acknowledged dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1925 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-acknowledged-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-acknowledged-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1925 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1925 pixels (ratio 0.01 of all image pixels) are different.

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
                - generic [ref=e48]: ·Score 0
                - generic [ref=e49]: Passed
            - region "West" [ref=e50]:
              - generic [ref=e55]:
                - generic [ref=e56]: jordan_plays
                - generic [ref=e59]: West
              - generic [ref=e60]:
                - generic [ref=e61]: 13 cards
                - generic [ref=e62]: ·Score 0
                - generic [ref=e63]: Choosing
            - region "North" [ref=e64]:
              - generic [ref=e69]:
                - generic [ref=e70]: morgan
                - generic [ref=e73]: North
              - generic [ref=e74]:
                - generic [ref=e75]: 13 cards
                - generic [ref=e76]: ·Score 0
                - generic [ref=e77]: Choosing
            - region "East" [ref=e78]:
              - generic [ref=e83]:
                - generic [ref=e84]: robin_42
                - generic [ref=e87]: East
              - generic [ref=e88]:
                - generic [ref=e89]: 13 cards
                - generic [ref=e90]: ·Score 0
                - generic [ref=e91]: Choosing
            - generic [ref=e92]:
              - generic [ref=e93]: Passed to the left
              - generic [ref=e94]:
                - generic [ref=e96]:
                  - generic [ref=e97]: 6 ♣
                  - generic [ref=e98]: ♣
                  - generic [ref=e99]: clubs
                - generic [ref=e101]:
                  - generic [ref=e102]: 4 ♠
                  - generic [ref=e103]: ♠
                  - generic [ref=e104]: spades
                - generic [ref=e106]:
                  - generic [ref=e107]: J ♥
                  - generic [ref=e108]: ♥
                  - generic [ref=e109]: hearts
            - paragraph [ref=e110]: Your cards are chosen. Waiting for every player to pass. South has passed.
          - toolbar "Your hand" [ref=e111]:
            - button "6 clubs, Six of clubs" [disabled] [pressed] [ref=e112]:
              - generic [ref=e113]: 6 ♣
              - generic [ref=e114]: ♣
              - generic [ref=e115]: clubs
            - button "A clubs, Ace of clubs" [disabled] [ref=e116]:
              - generic [ref=e117]: A ♣
              - generic [ref=e118]: ♣
              - generic [ref=e119]: clubs
            - button "10 diamonds, Ten of diamonds" [disabled] [ref=e120]:
              - generic [ref=e121]: 10 ♦
              - generic [ref=e122]: ♦
              - generic [ref=e123]: diamonds
            - button "3 spades, Three of spades" [disabled] [ref=e124]:
              - generic [ref=e125]: 3 ♠
              - generic [ref=e126]: ♠
              - generic [ref=e127]: spades
            - button "4 spades, Four of spades" [disabled] [pressed] [ref=e128]:
              - generic [ref=e129]: 4 ♠
              - generic [ref=e130]: ♠
              - generic [ref=e131]: spades
            - button "10 spades, Ten of spades" [disabled] [ref=e132]:
              - generic [ref=e133]: 10 ♠
              - generic [ref=e134]: ♠
              - generic [ref=e135]: spades
            - button "2 hearts, Two of hearts" [disabled] [ref=e136]:
              - generic [ref=e137]: 2 ♥
              - generic [ref=e138]: ♥
              - generic [ref=e139]: hearts
            - button "4 hearts, Four of hearts" [disabled] [ref=e140]:
              - generic [ref=e141]: 4 ♥
              - generic [ref=e142]: ♥
              - generic [ref=e143]: hearts
            - button "5 hearts, Five of hearts" [disabled] [ref=e144]:
              - generic [ref=e145]: 5 ♥
              - generic [ref=e146]: ♥
              - generic [ref=e147]: hearts
            - button "7 hearts, Seven of hearts" [disabled] [ref=e148]:
              - generic [ref=e149]: 7 ♥
              - generic [ref=e150]: ♥
              - generic [ref=e151]: hearts
            - button "8 hearts, Eight of hearts" [disabled] [ref=e152]:
              - generic [ref=e153]: 8 ♥
              - generic [ref=e154]: ♥
              - generic [ref=e155]: hearts
            - button "J hearts, Jack of hearts" [disabled] [pressed] [ref=e156]:
              - generic [ref=e157]: J ♥
              - generic [ref=e158]: ♥
              - generic [ref=e159]: hearts
            - button "Q hearts, Queen of hearts" [disabled] [ref=e160]:
              - generic [ref=e161]: Q ♥
              - generic [ref=e162]: ♥
              - generic [ref=e163]: hearts
          - status
        - status [ref=e165]:
          - generic [ref=e166]:
            - generic [ref=e167]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: Passing to the left
      - region "Game record" [ref=e170]:
        - generic [ref=e171]:
          - heading "Game record" [level=2] [ref=e173]
          - paragraph [ref=e174]: Passing to the left
        - generic [ref=e175]:
          - generic [ref=e176]:
            - generic [ref=e177]:
              - paragraph [ref=e178]: Deal 1
              - paragraph [ref=e179]: Pass left
            - generic [ref=e181]: Now
          - generic [ref=e183]:
            - paragraph [ref=e184]: Deal 2
            - paragraph [ref=e185]: Pass right
          - generic [ref=e187]:
            - paragraph [ref=e188]: Deal 3
            - paragraph [ref=e189]: Pass across
          - generic [ref=e191]:
            - paragraph [ref=e192]: Deal 4
            - paragraph [ref=e193]: No passing
        - generic [ref=e195]:
          - group "Game actions" [ref=e196]:
            - button "Resign game" [ref=e197] [cursor=pointer]:
              - paragraph [ref=e200]:
                - text: Resign
                - generic [ref=e201]: game
          - button "History and stats" [ref=e202] [cursor=pointer]:
            - paragraph [ref=e205]: History and stats
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