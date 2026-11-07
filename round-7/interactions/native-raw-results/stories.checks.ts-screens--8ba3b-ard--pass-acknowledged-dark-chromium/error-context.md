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
  68442 pixels (ratio 0.21 of all image pixels) are different.

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
  - 68442 pixels (ratio 0.21 of all image pixels) are different.
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
  - 68442 pixels (ratio 0.21 of all image pixels) are different.

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
                - generic [ref=e47]:
                  - generic [ref=e48]: avery
                  - generic [ref=e49]:
                    - generic [ref=e51]: You
                    - generic [ref=e53]: Chosen
                    - generic [ref=e55]: South
                - generic [ref=e56]:
                  - generic [ref=e57]: 13 cards
                  - generic [ref=e58]: Score 0
                  - generic [ref=e59]: Passed
              - region "West" [ref=e60]:
                - generic [ref=e63]:
                  - generic [ref=e64]: jordan_plays
                  - generic [ref=e67]: West
                - generic [ref=e68]:
                  - generic [ref=e69]: 13 cards
                  - generic [ref=e70]: Score 0
                  - generic [ref=e71]: Choosing
              - region "North" [ref=e72]:
                - generic [ref=e75]:
                  - generic [ref=e76]: morgan
                  - generic [ref=e79]: North
                - generic [ref=e80]:
                  - generic [ref=e81]: 13 cards
                  - generic [ref=e82]: Score 0
                  - generic [ref=e83]: Choosing
              - region "East" [ref=e84]:
                - generic [ref=e87]:
                  - generic [ref=e88]: robin_42
                  - generic [ref=e91]: East
                - generic [ref=e92]:
                  - generic [ref=e93]: 13 cards
                  - generic [ref=e94]: Score 0
                  - generic [ref=e95]: Choosing
              - generic [ref=e96]:
                - generic [ref=e97]: Passed to the left
                - generic [ref=e98]:
                  - generic [ref=e100]:
                    - generic [ref=e101]: 6 ♣
                    - generic [ref=e102]: ♣
                    - generic [ref=e103]: clubs
                  - generic [ref=e105]:
                    - generic [ref=e106]: 4 ♠
                    - generic [ref=e107]: ♠
                    - generic [ref=e108]: spades
                  - generic [ref=e110]:
                    - generic [ref=e111]: J ♥
                    - generic [ref=e112]: ♥
                    - generic [ref=e113]: hearts
              - paragraph [ref=e114]: Your cards are chosen. Waiting for every player to pass. South has passed.
            - toolbar "Your hand" [ref=e115]:
              - button "6 clubs, Six of clubs" [disabled] [pressed] [ref=e116]:
                - generic [ref=e117]: 6 ♣
                - generic [ref=e118]: ♣
                - generic [ref=e119]: clubs
              - button "A clubs, Ace of clubs" [disabled] [ref=e120]:
                - generic [ref=e121]: A ♣
                - generic [ref=e122]: ♣
                - generic [ref=e123]: clubs
              - button "10 diamonds, Ten of diamonds" [disabled] [ref=e124]:
                - generic [ref=e125]: 10 ♦
                - generic [ref=e126]: ♦
                - generic [ref=e127]: diamonds
              - button "3 spades, Three of spades" [disabled] [ref=e128]:
                - generic [ref=e129]: 3 ♠
                - generic [ref=e130]: ♠
                - generic [ref=e131]: spades
              - button "4 spades, Four of spades" [disabled] [pressed] [ref=e132]:
                - generic [ref=e133]: 4 ♠
                - generic [ref=e134]: ♠
                - generic [ref=e135]: spades
              - button "10 spades, Ten of spades" [disabled] [ref=e136]:
                - generic [ref=e137]: 10 ♠
                - generic [ref=e138]: ♠
                - generic [ref=e139]: spades
              - button "2 hearts, Two of hearts" [disabled] [ref=e140]:
                - generic [ref=e141]: 2 ♥
                - generic [ref=e142]: ♥
                - generic [ref=e143]: hearts
              - button "4 hearts, Four of hearts" [disabled] [ref=e144]:
                - generic [ref=e145]: 4 ♥
                - generic [ref=e146]: ♥
                - generic [ref=e147]: hearts
              - button "5 hearts, Five of hearts" [disabled] [ref=e148]:
                - generic [ref=e149]: 5 ♥
                - generic [ref=e150]: ♥
                - generic [ref=e151]: hearts
              - button "7 hearts, Seven of hearts" [disabled] [ref=e152]:
                - generic [ref=e153]: 7 ♥
                - generic [ref=e154]: ♥
                - generic [ref=e155]: hearts
              - button "8 hearts, Eight of hearts" [disabled] [ref=e156]:
                - generic [ref=e157]: 8 ♥
                - generic [ref=e158]: ♥
                - generic [ref=e159]: hearts
              - button "J hearts, Jack of hearts" [disabled] [pressed] [ref=e160]:
                - generic [ref=e161]: J ♥
                - generic [ref=e162]: ♥
                - generic [ref=e163]: hearts
              - button "Q hearts, Queen of hearts" [disabled] [ref=e164]:
                - generic [ref=e165]: Q ♥
                - generic [ref=e166]: ♥
                - generic [ref=e167]: hearts
            - status
          - status [ref=e169]:
            - generic [ref=e170]:
              - generic [ref=e171]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: Passing to the left
        - generic [ref=e174]:
          - group "Game actions" [ref=e175]:
            - button "Resign game" [ref=e176] [cursor=pointer]:
              - paragraph [ref=e179]:
                - text: Resign
                - generic [ref=e180]: game
          - button "History and stats" [ref=e181] [cursor=pointer]:
            - generic [ref=e183]:
              - paragraph [ref=e184]: History and stats
              - img [ref=e187]
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