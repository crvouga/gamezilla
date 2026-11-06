# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--your-turn-to-play dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  78831 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/your-turn-to-play-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/your-turn-to-play-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 78831 pixels (ratio 0.24 of all image pixels) are different.
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
  - 78831 pixels (ratio 0.24 of all image pixels) are different.

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
        - paragraph [ref=e24]: North to play.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - group "Hearts table" [ref=e42]:
              - region "North (you)" [ref=e43]:
                - generic [ref=e49]:
                  - generic [ref=e50]: morgan
                  - generic [ref=e51]:
                    - generic [ref=e53]: You
                    - generic [ref=e55]: North
                - generic [ref=e56]:
                  - generic [ref=e57]: 9 cards
                  - generic [ref=e58]: Score 8
                  - generic [ref=e59]: Taken 0
              - region "East" [ref=e60]:
                - generic [ref=e65]:
                  - generic [ref=e66]: robin_42
                  - generic [ref=e69]: East
                - generic [ref=e70]:
                  - generic [ref=e71]: 9 cards
                  - generic [ref=e72]: Score 28
                  - generic [ref=e73]: Taken 0
              - region "South" [ref=e74]:
                - generic [ref=e79]:
                  - generic [ref=e80]: avery
                  - generic [ref=e83]: South
                - generic [ref=e84]:
                  - generic [ref=e85]: 8 cards
                  - generic [ref=e86]: Score 12
                  - generic [ref=e87]: Taken 0
              - region "West" [ref=e88]:
                - generic [ref=e93]:
                  - generic [ref=e94]: jordan_plays
                  - generic [ref=e97]: West
                - generic [ref=e98]:
                  - generic [ref=e99]: 8 cards
                  - generic [ref=e100]: Score 30
                  - generic [ref=e101]: Taken 0
              - generic [ref=e102]:
                - group "North (you)" [ref=e103]
                - group "East" [ref=e104]
                - group "South" [ref=e105]:
                  - img "3 spades, Three of spades" [ref=e106]:
                    - generic [ref=e107]: 3 ♠
                    - generic [ref=e108]: ♠
                    - generic [ref=e109]: spades
                - group "West" [ref=e110]:
                  - img "5 spades, Five of spades" [ref=e111]:
                    - generic [ref=e112]: 5 ♠
                    - generic [ref=e113]: ♠
                    - generic [ref=e114]: spades
              - paragraph [ref=e115]: North to play.
            - paragraph [ref=e116]: × You must follow suit with a card of the suit led.
            - toolbar "Your hand" [ref=e117]:
              - button "2 spades, Two of spades" [ref=e118] [cursor=pointer]:
                - generic [ref=e119]: 2 ♠
                - generic [ref=e120]: ♠
                - generic [ref=e121]: spades
              - button "8 spades, Eight of spades" [ref=e122] [cursor=pointer]:
                - generic [ref=e123]: 8 ♠
                - generic [ref=e124]: ♠
                - generic [ref=e125]: spades
              - button "2 diamonds, Two of diamonds" [disabled] [ref=e126]:
                - generic [ref=e127]: 2 ♦
                - generic [ref=e128]: ♦
                - generic [ref=e129]: diamonds
                - generic [ref=e130]: ×
              - button "8 diamonds, Eight of diamonds" [disabled] [ref=e131]:
                - generic [ref=e132]: 8 ♦
                - generic [ref=e133]: ♦
                - generic [ref=e134]: diamonds
                - generic [ref=e135]: ×
              - button "9 diamonds, Nine of diamonds" [disabled] [ref=e136]:
                - generic [ref=e137]: 9 ♦
                - generic [ref=e138]: ♦
                - generic [ref=e139]: diamonds
                - generic [ref=e140]: ×
              - button "J diamonds, Jack of diamonds" [disabled] [ref=e141]:
                - generic [ref=e142]: J ♦
                - generic [ref=e143]: ♦
                - generic [ref=e144]: diamonds
                - generic [ref=e145]: ×
              - button "K diamonds, King of diamonds" [disabled] [ref=e146]:
                - generic [ref=e147]: K ♦
                - generic [ref=e148]: ♦
                - generic [ref=e149]: diamonds
                - generic [ref=e150]: ×
              - button "3 hearts, Three of hearts" [disabled] [ref=e151]:
                - generic [ref=e152]: 3 ♥
                - generic [ref=e153]: ♥
                - generic [ref=e154]: hearts
                - generic [ref=e155]: ×
              - button "9 hearts, Nine of hearts" [disabled] [ref=e156]:
                - generic [ref=e157]: 9 ♥
                - generic [ref=e158]: ♥
                - generic [ref=e159]: hearts
                - generic [ref=e160]: ×
            - status
          - status [ref=e162]:
            - generic [ref=e163]:
              - generic [ref=e164]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: North to play.
        - generic [ref=e167]:
          - group "Game actions" [ref=e168]:
            - button "Resign game" [ref=e169] [cursor=pointer]:
              - paragraph [ref=e172]:
                - text: Resign
                - generic [ref=e173]: game
          - button "History and stats" [ref=e174] [cursor=pointer]:
            - generic [ref=e176]:
              - paragraph [ref=e177]: History and stats
              - img [ref=e180]
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