# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--trick-taken light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  70346 pixels (ratio 0.22 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/trick-taken-light.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/trick-taken-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 70346 pixels (ratio 0.22 of all image pixels) are different.
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
  - 70346 pixels (ratio 0.22 of all image pixels) are different.

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
        - paragraph [ref=e24]: East took the trick with the king of spades and leads.
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
                  - generic [ref=e57]: 8 cards
                  - generic [ref=e58]: Score 12
                  - generic [ref=e59]: Taken 0
              - region "West" [ref=e60]:
                - generic [ref=e65]:
                  - generic [ref=e66]: jordan_plays
                  - generic [ref=e69]: West
                - generic [ref=e70]:
                  - generic [ref=e71]: 8 cards
                  - generic [ref=e72]: Score 30
                  - generic [ref=e73]: Taken 0
              - region "North" [ref=e74]:
                - generic [ref=e79]:
                  - generic [ref=e80]: morgan
                  - generic [ref=e83]: North
                - generic [ref=e84]:
                  - generic [ref=e85]: 8 cards
                  - generic [ref=e86]: Score 8
                  - generic [ref=e87]: Taken 0
              - region "East" [ref=e88]:
                - generic [ref=e93]:
                  - generic [ref=e94]: robin_42
                  - generic [ref=e97]: East
                - generic [ref=e98]:
                  - generic [ref=e99]: 8 cards
                  - generic [ref=e100]: Score 28
                  - generic [ref=e101]: Taken 0
              - generic [ref=e102]:
                - group "South (you)" [ref=e103]:
                  - img "3 spades, Three of spades" [ref=e104]:
                    - generic [ref=e105]: 3 ♠
                    - generic [ref=e106]: ♠
                    - generic [ref=e107]: spades
                - group "West" [ref=e108]:
                  - img "5 spades, Five of spades" [ref=e109]:
                    - generic [ref=e110]: 5 ♠
                    - generic [ref=e111]: ♠
                    - generic [ref=e112]: spades
                - group "North" [ref=e113]:
                  - img "8 spades, Eight of spades" [ref=e114]:
                    - generic [ref=e115]: 8 ♠
                    - generic [ref=e116]: ♠
                    - generic [ref=e117]: spades
                - group "East" [ref=e118]:
                  - img "K spades, King of spades" [ref=e119]:
                    - generic [ref=e120]: K ♠
                    - generic [ref=e121]: ♠
                    - generic [ref=e122]: spades
              - paragraph [ref=e123]: East took the trick with the king of spades and leads.
            - paragraph [ref=e124]: × It is not your turn to play.
            - toolbar "Your hand" [ref=e125]:
              - button "10 spades, Ten of spades" [disabled] [ref=e126]:
                - generic [ref=e127]: 10 ♠
                - generic [ref=e128]: ♠
                - generic [ref=e129]: spades
                - generic [ref=e130]: ×
              - button "2 hearts, Two of hearts" [disabled] [ref=e131]:
                - generic [ref=e132]: 2 ♥
                - generic [ref=e133]: ♥
                - generic [ref=e134]: hearts
                - generic [ref=e135]: ×
              - button "4 hearts, Four of hearts" [disabled] [ref=e136]:
                - generic [ref=e137]: 4 ♥
                - generic [ref=e138]: ♥
                - generic [ref=e139]: hearts
                - generic [ref=e140]: ×
              - button "5 hearts, Five of hearts" [disabled] [ref=e141]:
                - generic [ref=e142]: 5 ♥
                - generic [ref=e143]: ♥
                - generic [ref=e144]: hearts
                - generic [ref=e145]: ×
              - button "7 hearts, Seven of hearts" [disabled] [ref=e146]:
                - generic [ref=e147]: 7 ♥
                - generic [ref=e148]: ♥
                - generic [ref=e149]: hearts
                - generic [ref=e150]: ×
              - button "8 hearts, Eight of hearts" [disabled] [ref=e151]:
                - generic [ref=e152]: 8 ♥
                - generic [ref=e153]: ♥
                - generic [ref=e154]: hearts
                - generic [ref=e155]: ×
              - button "J hearts, Jack of hearts" [disabled] [ref=e156]:
                - generic [ref=e157]: J ♥
                - generic [ref=e158]: ♥
                - generic [ref=e159]: hearts
                - generic [ref=e160]: ×
              - button "Q hearts, Queen of hearts" [disabled] [ref=e161]:
                - generic [ref=e162]: Q ♥
                - generic [ref=e163]: ♥
                - generic [ref=e164]: hearts
                - generic [ref=e165]: ×
            - status
          - status [ref=e167]:
            - generic [ref=e168]:
              - generic [ref=e169]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: East took the trick with the king of spades and leads.
        - generic [ref=e172]:
          - group "Game actions" [ref=e173]:
            - button "Resign game" [ref=e174] [cursor=pointer]:
              - paragraph [ref=e177]:
                - text: Resign
                - generic [ref=e178]: game
          - button "History and stats" [ref=e179] [cursor=pointer]:
            - generic [ref=e181]:
              - paragraph [ref=e182]: History and stats
              - img [ref=e185]
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