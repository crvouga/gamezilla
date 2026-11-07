# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--waiting-for-turn dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  123436 pixels (ratio 0.38 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/waiting-for-turn-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/waiting-for-turn-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 123436 pixels (ratio 0.38 of all image pixels) are different.
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
  - 123436 pixels (ratio 0.38 of all image pixels) are different.

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
        - paragraph [ref=e24]: morgan to play.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - group "Hearts table" [ref=e42]:
              - region "East (you)" [ref=e43]:
                - generic [ref=e47]:
                  - generic [ref=e48]: robin_42
                  - generic [ref=e49]:
                    - generic [ref=e51]: You
                    - generic [ref=e53]: East
                - generic [ref=e54]:
                  - generic [ref=e55]: 9 cards
                  - generic [ref=e56]: Score 28
                  - generic [ref=e57]: Taken 0
              - region "South" [ref=e58]:
                - generic [ref=e61]:
                  - generic [ref=e62]: avery
                  - generic [ref=e65]: South
                - generic [ref=e66]:
                  - generic [ref=e67]: 8 cards
                  - generic [ref=e68]: Score 12
                  - generic [ref=e69]: Taken 0
              - region "West" [ref=e70]:
                - generic [ref=e73]:
                  - generic [ref=e74]: jordan_plays
                  - generic [ref=e77]: West
                - generic [ref=e78]:
                  - generic [ref=e79]: 8 cards
                  - generic [ref=e80]: Score 30
                  - generic [ref=e81]: Taken 0
              - region "North" [ref=e82]:
                - generic [ref=e85]:
                  - generic [ref=e86]: morgan
                  - generic [ref=e89]: North
                - generic [ref=e90]:
                  - generic [ref=e91]: 9 cards
                  - generic [ref=e92]: Score 8
                  - generic [ref=e93]: Taken 0
              - generic [ref=e94]:
                - group "East (you)" [ref=e95]
                - group "South" [ref=e96]:
                  - img "3 spades, Three of spades" [ref=e97]:
                    - generic [ref=e98]: 3 ♠
                    - generic [ref=e99]: ♠
                    - generic [ref=e100]: spades
                - group "West" [ref=e101]:
                  - img "5 spades, Five of spades" [ref=e102]:
                    - generic [ref=e103]: 5 ♠
                    - generic [ref=e104]: ♠
                    - generic [ref=e105]: spades
                - group "North" [ref=e106]
              - paragraph [ref=e107]: morgan to play.
            - paragraph [ref=e108]: × It is not your turn to play.
            - toolbar "Your hand" [ref=e109]:
              - button "5 clubs, Five of clubs" [disabled] [ref=e110]:
                - generic [ref=e111]: 5 ♣
                - generic [ref=e112]: ♣
                - generic [ref=e113]: clubs
                - generic [ref=e114]: ×
              - button "9 clubs, Nine of clubs" [disabled] [ref=e115]:
                - generic [ref=e116]: 9 ♣
                - generic [ref=e117]: ♣
                - generic [ref=e118]: clubs
                - generic [ref=e119]: ×
              - button "J clubs, Jack of clubs" [disabled] [ref=e120]:
                - generic [ref=e121]: J ♣
                - generic [ref=e122]: ♣
                - generic [ref=e123]: clubs
                - generic [ref=e124]: ×
              - button "5 diamonds, Five of diamonds" [disabled] [ref=e125]:
                - generic [ref=e126]: 5 ♦
                - generic [ref=e127]: ♦
                - generic [ref=e128]: diamonds
                - generic [ref=e129]: ×
              - button "A diamonds, Ace of diamonds" [disabled] [ref=e130]:
                - generic [ref=e131]: A ♦
                - generic [ref=e132]: ♦
                - generic [ref=e133]: diamonds
                - generic [ref=e134]: ×
              - button "K spades, King of spades" [disabled] [ref=e135]:
                - generic [ref=e136]: K ♠
                - generic [ref=e137]: ♠
                - generic [ref=e138]: spades
                - generic [ref=e139]: ×
              - button "10 hearts, Ten of hearts" [disabled] [ref=e140]:
                - generic [ref=e141]: 10 ♥
                - generic [ref=e142]: ♥
                - generic [ref=e143]: hearts
                - generic [ref=e144]: ×
              - button "K hearts, King of hearts" [disabled] [ref=e145]:
                - generic [ref=e146]: K ♥
                - generic [ref=e147]: ♥
                - generic [ref=e148]: hearts
                - generic [ref=e149]: ×
              - button "A hearts, Ace of hearts" [disabled] [ref=e150]:
                - generic [ref=e151]: A ♥
                - generic [ref=e152]: ♥
                - generic [ref=e153]: hearts
                - generic [ref=e154]: ×
            - status
          - status [ref=e156]:
            - generic [ref=e157]:
              - generic [ref=e158]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: morgan to play.
        - generic [ref=e161]:
          - group "Game actions" [ref=e162]:
            - button "Resign game" [ref=e163] [cursor=pointer]:
              - paragraph [ref=e166]:
                - text: Resign
                - generic [ref=e167]: game
          - button "History and stats" [ref=e168] [cursor=pointer]:
            - generic [ref=e170]:
              - paragraph [ref=e171]: History and stats
              - img [ref=e174]
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