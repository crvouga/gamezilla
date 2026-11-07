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
  84390 pixels (ratio 0.26 of all image pixels) are different.

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
  - 84390 pixels (ratio 0.26 of all image pixels) are different.
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
  - 84390 pixels (ratio 0.26 of all image pixels) are different.

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
        - paragraph [ref=e24]: robin_42 took the trick with the king of spades and leads.
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
                    - generic [ref=e53]: South
                - generic [ref=e54]:
                  - generic [ref=e55]: 8 cards
                  - generic [ref=e56]: Score 12
                  - generic [ref=e57]: Taken 0
              - region "West" [ref=e58]:
                - generic [ref=e61]:
                  - generic [ref=e62]: jordan_plays
                  - generic [ref=e65]: West
                - generic [ref=e66]:
                  - generic [ref=e67]: 8 cards
                  - generic [ref=e68]: Score 30
                  - generic [ref=e69]: Taken 0
              - region "North" [ref=e70]:
                - generic [ref=e73]:
                  - generic [ref=e74]: morgan
                  - generic [ref=e77]: North
                - generic [ref=e78]:
                  - generic [ref=e79]: 8 cards
                  - generic [ref=e80]: Score 8
                  - generic [ref=e81]: Taken 0
              - region "East" [ref=e82]:
                - generic [ref=e85]:
                  - generic [ref=e86]: robin_42
                  - generic [ref=e89]: East
                - generic [ref=e90]:
                  - generic [ref=e91]: 8 cards
                  - generic [ref=e92]: Score 28
                  - generic [ref=e93]: Taken 0
              - generic [ref=e94]:
                - group "South (you)" [ref=e95]:
                  - img "3 spades, Three of spades" [ref=e96]:
                    - generic [ref=e97]: 3 ♠
                    - generic [ref=e98]: ♠
                    - generic [ref=e99]: spades
                - group "West" [ref=e100]:
                  - img "5 spades, Five of spades" [ref=e101]:
                    - generic [ref=e102]: 5 ♠
                    - generic [ref=e103]: ♠
                    - generic [ref=e104]: spades
                - group "North" [ref=e105]:
                  - img "8 spades, Eight of spades" [ref=e106]:
                    - generic [ref=e107]: 8 ♠
                    - generic [ref=e108]: ♠
                    - generic [ref=e109]: spades
                - group "East" [ref=e110]:
                  - img "K spades, King of spades" [ref=e111]:
                    - generic [ref=e112]: K ♠
                    - generic [ref=e113]: ♠
                    - generic [ref=e114]: spades
              - paragraph [ref=e115]: robin_42 took the trick with the king of spades and leads.
            - paragraph [ref=e116]: × It is not your turn to play.
            - toolbar "Your hand" [ref=e117]:
              - button "10 spades, Ten of spades" [disabled] [ref=e118]:
                - generic [ref=e119]: 10 ♠
                - generic [ref=e120]: ♠
                - generic [ref=e121]: spades
                - generic [ref=e122]: ×
              - button "2 hearts, Two of hearts" [disabled] [ref=e123]:
                - generic [ref=e124]: 2 ♥
                - generic [ref=e125]: ♥
                - generic [ref=e126]: hearts
                - generic [ref=e127]: ×
              - button "4 hearts, Four of hearts" [disabled] [ref=e128]:
                - generic [ref=e129]: 4 ♥
                - generic [ref=e130]: ♥
                - generic [ref=e131]: hearts
                - generic [ref=e132]: ×
              - button "5 hearts, Five of hearts" [disabled] [ref=e133]:
                - generic [ref=e134]: 5 ♥
                - generic [ref=e135]: ♥
                - generic [ref=e136]: hearts
                - generic [ref=e137]: ×
              - button "7 hearts, Seven of hearts" [disabled] [ref=e138]:
                - generic [ref=e139]: 7 ♥
                - generic [ref=e140]: ♥
                - generic [ref=e141]: hearts
                - generic [ref=e142]: ×
              - button "8 hearts, Eight of hearts" [disabled] [ref=e143]:
                - generic [ref=e144]: 8 ♥
                - generic [ref=e145]: ♥
                - generic [ref=e146]: hearts
                - generic [ref=e147]: ×
              - button "J hearts, Jack of hearts" [disabled] [ref=e148]:
                - generic [ref=e149]: J ♥
                - generic [ref=e150]: ♥
                - generic [ref=e151]: hearts
                - generic [ref=e152]: ×
              - button "Q hearts, Queen of hearts" [disabled] [ref=e153]:
                - generic [ref=e154]: Q ♥
                - generic [ref=e155]: ♥
                - generic [ref=e156]: hearts
                - generic [ref=e157]: ×
            - status
          - status [ref=e159]:
            - generic [ref=e160]:
              - generic [ref=e161]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: robin_42 took the trick with the king of spades and leads.
        - generic [ref=e164]:
          - group "Game actions" [ref=e165]:
            - button "Resign game" [ref=e166] [cursor=pointer]:
              - paragraph [ref=e169]:
                - text: Resign
                - generic [ref=e170]: game
          - button "History and stats" [ref=e171] [cursor=pointer]:
            - generic [ref=e173]:
              - paragraph [ref=e174]: History and stats
              - img [ref=e177]
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