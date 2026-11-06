# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--complete-trick dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  54253 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/complete-trick-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/complete-trick-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 54253 pixels (ratio 0.17 of all image pixels) are different.
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
  - 54253 pixels (ratio 0.17 of all image pixels) are different.

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
        - paragraph [ref=e24]: West took the trick with the ten of clubs and leads.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - group "Hearts table" [ref=e42]:
              - region "West (you)" [ref=e43]:
                - generic [ref=e49]:
                  - generic [ref=e50]: jordan_plays
                  - generic [ref=e51]:
                    - generic [ref=e53]: You
                    - generic [ref=e55]: West
                - generic [ref=e56]:
                  - generic [ref=e57]: 12 cards
                  - generic [ref=e58]: Score 30
                  - generic [ref=e59]: Taken 0
              - region "North" [ref=e60]:
                - generic [ref=e65]:
                  - generic [ref=e66]: morgan
                  - generic [ref=e69]: North
                - generic [ref=e70]:
                  - generic [ref=e71]: 12 cards
                  - generic [ref=e72]: ·Score 8
                  - generic [ref=e73]: ·Taken 0
              - region "East" [ref=e74]:
                - generic [ref=e79]:
                  - generic [ref=e80]: robin_42
                  - generic [ref=e83]: East
                - generic [ref=e84]:
                  - generic [ref=e85]: 12 cards
                  - generic [ref=e86]: Score 28
                  - generic [ref=e87]: Taken 0
              - region "South" [ref=e88]:
                - generic [ref=e93]:
                  - generic [ref=e94]: avery
                  - generic [ref=e97]: South
                - generic [ref=e98]:
                  - generic [ref=e99]: 12 cards
                  - generic [ref=e100]: ·Score 12
                  - generic [ref=e101]: ·Taken 0
              - generic [ref=e102]:
                - img "10 clubs, Ten of clubs" [ref=e104]:
                  - generic [ref=e105]: 10 ♣
                  - generic [ref=e106]: ♣
                  - generic [ref=e107]: clubs
                - img "8 clubs, Eight of clubs" [ref=e109]:
                  - generic [ref=e110]: 8 ♣
                  - generic [ref=e111]: ♣
                  - generic [ref=e112]: clubs
                - img "2 clubs, Two of clubs" [ref=e114]:
                  - generic [ref=e115]: 2 ♣
                  - generic [ref=e116]: ♣
                  - generic [ref=e117]: clubs
                - img "6 clubs, Six of clubs" [ref=e119]:
                  - generic [ref=e120]: 6 ♣
                  - generic [ref=e121]: ♣
                  - generic [ref=e122]: clubs
              - paragraph [ref=e123]: West took the trick with the ten of clubs and leads.
            - paragraph [ref=e124]: × Hearts are not broken yet. Lead another suit.
            - toolbar "Your hand" [ref=e125]:
              - button "3 clubs, Three of clubs" [active] [ref=e126] [cursor=pointer]:
                - generic [ref=e127]: 3 ♣
                - generic [ref=e128]: ♣
                - generic [ref=e129]: clubs
              - button "4 clubs, Four of clubs" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 4 ♣
                - generic [ref=e132]: ♣
                - generic [ref=e133]: clubs
              - button "Q clubs, Queen of clubs" [ref=e134] [cursor=pointer]:
                - generic [ref=e135]: Q ♣
                - generic [ref=e136]: ♣
                - generic [ref=e137]: clubs
              - button "3 diamonds, Three of diamonds" [ref=e138] [cursor=pointer]:
                - generic [ref=e139]: 3 ♦
                - generic [ref=e140]: ♦
                - generic [ref=e141]: diamonds
              - button "4 diamonds, Four of diamonds" [ref=e142] [cursor=pointer]:
                - generic [ref=e143]: 4 ♦
                - generic [ref=e144]: ♦
                - generic [ref=e145]: diamonds
              - button "7 diamonds, Seven of diamonds" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: 7 ♦
                - generic [ref=e148]: ♦
                - generic [ref=e149]: diamonds
              - button "5 spades, Five of spades" [ref=e150] [cursor=pointer]:
                - generic [ref=e151]: 5 ♠
                - generic [ref=e152]: ♠
                - generic [ref=e153]: spades
              - button "6 spades, Six of spades" [ref=e154] [cursor=pointer]:
                - generic [ref=e155]: 6 ♠
                - generic [ref=e156]: ♠
                - generic [ref=e157]: spades
              - button "7 spades, Seven of spades" [ref=e158] [cursor=pointer]:
                - generic [ref=e159]: 7 ♠
                - generic [ref=e160]: ♠
                - generic [ref=e161]: spades
              - button "Q spades, Queen of spades" [ref=e162] [cursor=pointer]:
                - generic [ref=e163]: Q ♠
                - generic [ref=e164]: ♠
                - generic [ref=e165]: spades
              - button "A spades, Ace of spades" [ref=e166] [cursor=pointer]:
                - generic [ref=e167]: A ♠
                - generic [ref=e168]: ♠
                - generic [ref=e169]: spades
              - button "6 hearts, Six of hearts" [disabled] [ref=e170]:
                - generic [ref=e171]: 6 ♥
                - generic [ref=e172]: ♥
                - generic [ref=e173]: hearts
                - generic [ref=e174]: ×
            - status
          - status [ref=e176]:
            - generic [ref=e177]:
              - generic [ref=e178]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: West took the trick with the ten of clubs and leads.
        - generic [ref=e181]:
          - group "Game actions" [ref=e182]:
            - button "Resign game" [ref=e183] [cursor=pointer]:
              - paragraph [ref=e186]:
                - text: Resign
                - generic [ref=e187]: game
          - button "History and stats" [ref=e188] [cursor=pointer]:
            - generic [ref=e190]:
              - paragraph [ref=e191]: History and stats
              - img [ref=e194]
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