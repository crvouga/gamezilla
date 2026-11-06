# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--pass-through-first-trick dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  85736 pixels (ratio 0.27 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-through-first-trick-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/pass-through-first-trick-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 85736 pixels (ratio 0.27 of all image pixels) are different.
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
  - 85736 pixels (ratio 0.27 of all image pixels) are different.

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
        - paragraph [ref=e24]: South took the trick with the ace of clubs and leads.
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
                  - generic [ref=e57]: 12 cards
                  - generic [ref=e58]: Score 0
                  - generic [ref=e59]: Taken 0
              - region "West" [ref=e60]:
                - generic [ref=e65]:
                  - generic [ref=e66]: jordan_plays
                  - generic [ref=e69]: West
                - generic [ref=e70]:
                  - generic [ref=e71]: 12 cards
                  - generic [ref=e72]: Score 0
                  - generic [ref=e73]: Taken 0
              - region "North" [ref=e74]:
                - generic [ref=e79]:
                  - generic [ref=e80]: morgan
                  - generic [ref=e83]: North
                - generic [ref=e84]:
                  - generic [ref=e85]: 12 cards
                  - generic [ref=e86]: Score 0
                  - generic [ref=e87]: Taken 0
              - region "East" [ref=e88]:
                - generic [ref=e93]:
                  - generic [ref=e94]: robin_42
                  - generic [ref=e97]: East
                - generic [ref=e98]:
                  - generic [ref=e99]: 12 cards
                  - generic [ref=e100]: Score 0
                  - generic [ref=e101]: Taken 0
              - generic [ref=e102]:
                - group "South (you)" [ref=e103]:
                  - img "A clubs, Ace of clubs" [ref=e104]:
                    - generic [ref=e105]: A ♣
                    - generic [ref=e106]: ♣
                    - generic [ref=e107]: clubs
                - group "West" [ref=e108]:
                  - img "10 clubs, Ten of clubs" [ref=e109]:
                    - generic [ref=e110]: 10 ♣
                    - generic [ref=e111]: ♣
                    - generic [ref=e112]: clubs
                - group "North" [ref=e113]:
                  - img "Q diamonds, Queen of diamonds" [ref=e114]:
                    - generic [ref=e115]: Q ♦
                    - generic [ref=e116]: ♦
                    - generic [ref=e117]: diamonds
                - group "East" [ref=e118]:
                  - img "2 clubs, Two of clubs" [ref=e119]:
                    - generic [ref=e120]: 2 ♣
                    - generic [ref=e121]: ♣
                    - generic [ref=e122]: clubs
              - paragraph [ref=e123]: South took the trick with the ace of clubs and leads.
            - paragraph [ref=e124]: × Hearts are not broken yet. Lead another suit.
            - toolbar "Your hand" [ref=e125]:
              - button "6 diamonds, Six of diamonds" [ref=e126] [cursor=pointer]:
                - generic [ref=e127]: 6 ♦
                - generic [ref=e128]: ♦
                - generic [ref=e129]: diamonds
              - button "10 diamonds, Ten of diamonds" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 10 ♦
                - generic [ref=e132]: ♦
                - generic [ref=e133]: diamonds
              - button "3 spades, Three of spades" [ref=e134] [cursor=pointer]:
                - generic [ref=e135]: 3 ♠
                - generic [ref=e136]: ♠
                - generic [ref=e137]: spades
              - button "10 spades, Ten of spades" [ref=e138] [cursor=pointer]:
                - generic [ref=e139]: 10 ♠
                - generic [ref=e140]: ♠
                - generic [ref=e141]: spades
              - button "J spades, Jack of spades" [ref=e142] [cursor=pointer]:
                - generic [ref=e143]: J ♠
                - generic [ref=e144]: ♠
                - generic [ref=e145]: spades
              - button "2 hearts, Two of hearts" [disabled] [ref=e146]:
                - generic [ref=e147]: 2 ♥
                - generic [ref=e148]: ♥
                - generic [ref=e149]: hearts
                - generic [ref=e150]: ×
              - button "4 hearts, Four of hearts" [disabled] [ref=e151]:
                - generic [ref=e152]: 4 ♥
                - generic [ref=e153]: ♥
                - generic [ref=e154]: hearts
                - generic [ref=e155]: ×
              - button "5 hearts, Five of hearts" [disabled] [ref=e156]:
                - generic [ref=e157]: 5 ♥
                - generic [ref=e158]: ♥
                - generic [ref=e159]: hearts
                - generic [ref=e160]: ×
              - button "7 hearts, Seven of hearts" [disabled] [ref=e161]:
                - generic [ref=e162]: 7 ♥
                - generic [ref=e163]: ♥
                - generic [ref=e164]: hearts
                - generic [ref=e165]: ×
              - button "8 hearts, Eight of hearts" [disabled] [ref=e166]:
                - generic [ref=e167]: 8 ♥
                - generic [ref=e168]: ♥
                - generic [ref=e169]: hearts
                - generic [ref=e170]: ×
              - button "10 hearts, Ten of hearts" [disabled] [ref=e171]:
                - generic [ref=e172]: 10 ♥
                - generic [ref=e173]: ♥
                - generic [ref=e174]: hearts
                - generic [ref=e175]: ×
              - button "Q hearts, Queen of hearts" [disabled] [ref=e176]:
                - generic [ref=e177]: Q ♥
                - generic [ref=e178]: ♥
                - generic [ref=e179]: hearts
                - generic [ref=e180]: ×
            - status
          - status [ref=e182]:
            - generic [ref=e183]:
              - generic [ref=e184]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: South took the trick with the ace of clubs and leads.
        - generic [ref=e187]:
          - group "Game actions" [ref=e188]:
            - button "Resign game" [ref=e189] [cursor=pointer]:
              - paragraph [ref=e192]:
                - text: Resign
                - generic [ref=e193]: game
          - button "History and stats" [ref=e194] [cursor=pointer]:
            - generic [ref=e196]:
              - paragraph [ref=e197]: History and stats
              - img [ref=e200]
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