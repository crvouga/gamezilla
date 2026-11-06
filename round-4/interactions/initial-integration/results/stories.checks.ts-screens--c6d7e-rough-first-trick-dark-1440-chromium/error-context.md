# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--pass-through-first-trick dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  55374 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-through-first-trick-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-through-first-trick-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 55374 pixels (ratio 0.05 of all image pixels) are different.
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
  - 55374 pixels (ratio 0.05 of all image pixels) are different.

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
                  - generic [ref=e43]: South
              - generic [ref=e44]:
                - generic [ref=e45]: 12 cards
                - generic [ref=e46]: Score 0
                - generic [ref=e47]: Taken 0
            - region "West" [ref=e48]:
              - generic [ref=e53]:
                - generic [ref=e54]: jordan_plays
                - generic [ref=e57]: West
              - generic [ref=e58]:
                - generic [ref=e59]: 12 cards
                - generic [ref=e60]: Score 0
                - generic [ref=e61]: Taken 0
            - region "North" [ref=e62]:
              - generic [ref=e67]:
                - generic [ref=e68]: morgan
                - generic [ref=e71]: North
              - generic [ref=e72]:
                - generic [ref=e73]: 12 cards
                - generic [ref=e74]: Score 0
                - generic [ref=e75]: Taken 0
            - region "East" [ref=e76]:
              - generic [ref=e81]:
                - generic [ref=e82]: robin_42
                - generic [ref=e85]: East
              - generic [ref=e86]:
                - generic [ref=e87]: 12 cards
                - generic [ref=e88]: Score 0
                - generic [ref=e89]: Taken 0
            - generic [ref=e90]:
              - group "South (you)" [ref=e91]:
                - img "A clubs, Ace of clubs" [ref=e92]:
                  - generic [ref=e93]: A ♣
                  - generic [ref=e94]: ♣
                  - generic [ref=e95]: clubs
              - group "West" [ref=e96]:
                - img "10 clubs, Ten of clubs" [ref=e97]:
                  - generic [ref=e98]: 10 ♣
                  - generic [ref=e99]: ♣
                  - generic [ref=e100]: clubs
              - group "North" [ref=e101]:
                - img "Q diamonds, Queen of diamonds" [ref=e102]:
                  - generic [ref=e103]: Q ♦
                  - generic [ref=e104]: ♦
                  - generic [ref=e105]: diamonds
              - group "East" [ref=e106]:
                - img "2 clubs, Two of clubs" [ref=e107]:
                  - generic [ref=e108]: 2 ♣
                  - generic [ref=e109]: ♣
                  - generic [ref=e110]: clubs
            - paragraph [ref=e111]: South took the trick with the ace of clubs and leads.
          - paragraph [ref=e112]: × Hearts are not broken yet. Lead another suit.
          - toolbar "Your hand" [ref=e113]:
            - button "6 diamonds, Six of diamonds" [ref=e114] [cursor=pointer]:
              - generic [ref=e115]: 6 ♦
              - generic [ref=e116]: ♦
              - generic [ref=e117]: diamonds
            - button "10 diamonds, Ten of diamonds" [ref=e118] [cursor=pointer]:
              - generic [ref=e119]: 10 ♦
              - generic [ref=e120]: ♦
              - generic [ref=e121]: diamonds
            - button "3 spades, Three of spades" [ref=e122] [cursor=pointer]:
              - generic [ref=e123]: 3 ♠
              - generic [ref=e124]: ♠
              - generic [ref=e125]: spades
            - button "10 spades, Ten of spades" [ref=e126] [cursor=pointer]:
              - generic [ref=e127]: 10 ♠
              - generic [ref=e128]: ♠
              - generic [ref=e129]: spades
            - button "J spades, Jack of spades" [ref=e130] [cursor=pointer]:
              - generic [ref=e131]: J ♠
              - generic [ref=e132]: ♠
              - generic [ref=e133]: spades
            - button "2 hearts, Two of hearts" [disabled] [ref=e134]:
              - generic [ref=e135]: 2 ♥
              - generic [ref=e136]: ♥
              - generic [ref=e137]: hearts
              - generic [ref=e138]: ×
            - button "4 hearts, Four of hearts" [disabled] [ref=e139]:
              - generic [ref=e140]: 4 ♥
              - generic [ref=e141]: ♥
              - generic [ref=e142]: hearts
              - generic [ref=e143]: ×
            - button "5 hearts, Five of hearts" [disabled] [ref=e144]:
              - generic [ref=e145]: 5 ♥
              - generic [ref=e146]: ♥
              - generic [ref=e147]: hearts
              - generic [ref=e148]: ×
            - button "7 hearts, Seven of hearts" [disabled] [ref=e149]:
              - generic [ref=e150]: 7 ♥
              - generic [ref=e151]: ♥
              - generic [ref=e152]: hearts
              - generic [ref=e153]: ×
            - button "8 hearts, Eight of hearts" [disabled] [ref=e154]:
              - generic [ref=e155]: 8 ♥
              - generic [ref=e156]: ♥
              - generic [ref=e157]: hearts
              - generic [ref=e158]: ×
            - button "10 hearts, Ten of hearts" [disabled] [ref=e159]:
              - generic [ref=e160]: 10 ♥
              - generic [ref=e161]: ♥
              - generic [ref=e162]: hearts
              - generic [ref=e163]: ×
            - button "Q hearts, Queen of hearts" [disabled] [ref=e164]:
              - generic [ref=e165]: Q ♥
              - generic [ref=e166]: ♥
              - generic [ref=e167]: hearts
              - generic [ref=e168]: ×
          - status
        - status [ref=e170]:
          - generic [ref=e171]:
            - generic [ref=e172]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: South took the trick with the ace of clubs and leads.
      - region "Game record" [ref=e175]:
        - generic [ref=e176]:
          - heading "Game record" [level=2] [ref=e178]
          - paragraph [ref=e179]: South took the trick with the ace of clubs and leads.
        - generic [ref=e180]:
          - generic [ref=e181]:
            - generic [ref=e182]:
              - paragraph [ref=e183]: Deal 1
              - paragraph [ref=e184]: Pass left
            - generic [ref=e186]: Now
          - generic [ref=e188]:
            - paragraph [ref=e189]: Deal 2
            - paragraph [ref=e190]: Pass right
          - generic [ref=e192]:
            - paragraph [ref=e193]: Deal 3
            - paragraph [ref=e194]: Pass across
          - generic [ref=e196]:
            - paragraph [ref=e197]: Deal 4
            - paragraph [ref=e198]: No passing
        - generic [ref=e200]:
          - group "Game actions" [ref=e201]:
            - button "Resign game" [ref=e202] [cursor=pointer]:
              - paragraph [ref=e205]:
                - text: Resign
                - generic [ref=e206]: game
          - button "History and stats" [ref=e207] [cursor=pointer]:
            - paragraph [ref=e210]: History and stats
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