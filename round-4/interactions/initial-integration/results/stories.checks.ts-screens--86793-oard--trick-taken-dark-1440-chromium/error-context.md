# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--trick-taken dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  3190 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/trick-taken-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/trick-taken-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3190 pixels (ratio 0.01 of all image pixels) are different.
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
  - 3190 pixels (ratio 0.01 of all image pixels) are different.

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
                - generic [ref=e45]: 8 cards
                - generic [ref=e46]: Score 12
                - generic [ref=e47]: Taken 0
            - region "West" [ref=e48]:
              - generic [ref=e53]:
                - generic [ref=e54]: jordan_plays
                - generic [ref=e57]: West
              - generic [ref=e58]:
                - generic [ref=e59]: 8 cards
                - generic [ref=e60]: Score 30
                - generic [ref=e61]: Taken 0
            - region "North" [ref=e62]:
              - generic [ref=e67]:
                - generic [ref=e68]: morgan
                - generic [ref=e71]: North
              - generic [ref=e72]:
                - generic [ref=e73]: 8 cards
                - generic [ref=e74]: Score 8
                - generic [ref=e75]: Taken 0
            - region "East" [ref=e76]:
              - generic [ref=e81]:
                - generic [ref=e82]: robin_42
                - generic [ref=e85]: East
              - generic [ref=e86]:
                - generic [ref=e87]: 8 cards
                - generic [ref=e88]: Score 28
                - generic [ref=e89]: Taken 0
            - generic [ref=e90]:
              - group "South (you)" [ref=e91]:
                - img "3 spades, Three of spades" [ref=e92]:
                  - generic [ref=e93]: 3 ♠
                  - generic [ref=e94]: ♠
                  - generic [ref=e95]: spades
              - group "West" [ref=e96]:
                - img "5 spades, Five of spades" [ref=e97]:
                  - generic [ref=e98]: 5 ♠
                  - generic [ref=e99]: ♠
                  - generic [ref=e100]: spades
              - group "North" [ref=e101]:
                - img "8 spades, Eight of spades" [ref=e102]:
                  - generic [ref=e103]: 8 ♠
                  - generic [ref=e104]: ♠
                  - generic [ref=e105]: spades
              - group "East" [ref=e106]:
                - img "K spades, King of spades" [ref=e107]:
                  - generic [ref=e108]: K ♠
                  - generic [ref=e109]: ♠
                  - generic [ref=e110]: spades
            - paragraph [ref=e111]: East took the trick with the king of spades and leads.
          - paragraph [ref=e112]: × It is not your turn to play.
          - toolbar "Your hand" [ref=e113]:
            - button "10 spades, Ten of spades" [disabled] [ref=e114]:
              - generic [ref=e115]: 10 ♠
              - generic [ref=e116]: ♠
              - generic [ref=e117]: spades
              - generic [ref=e118]: ×
            - button "2 hearts, Two of hearts" [disabled] [ref=e119]:
              - generic [ref=e120]: 2 ♥
              - generic [ref=e121]: ♥
              - generic [ref=e122]: hearts
              - generic [ref=e123]: ×
            - button "4 hearts, Four of hearts" [disabled] [ref=e124]:
              - generic [ref=e125]: 4 ♥
              - generic [ref=e126]: ♥
              - generic [ref=e127]: hearts
              - generic [ref=e128]: ×
            - button "5 hearts, Five of hearts" [disabled] [ref=e129]:
              - generic [ref=e130]: 5 ♥
              - generic [ref=e131]: ♥
              - generic [ref=e132]: hearts
              - generic [ref=e133]: ×
            - button "7 hearts, Seven of hearts" [disabled] [ref=e134]:
              - generic [ref=e135]: 7 ♥
              - generic [ref=e136]: ♥
              - generic [ref=e137]: hearts
              - generic [ref=e138]: ×
            - button "8 hearts, Eight of hearts" [disabled] [ref=e139]:
              - generic [ref=e140]: 8 ♥
              - generic [ref=e141]: ♥
              - generic [ref=e142]: hearts
              - generic [ref=e143]: ×
            - button "J hearts, Jack of hearts" [disabled] [ref=e144]:
              - generic [ref=e145]: J ♥
              - generic [ref=e146]: ♥
              - generic [ref=e147]: hearts
              - generic [ref=e148]: ×
            - button "Q hearts, Queen of hearts" [disabled] [ref=e149]:
              - generic [ref=e150]: Q ♥
              - generic [ref=e151]: ♥
              - generic [ref=e152]: hearts
              - generic [ref=e153]: ×
          - status
        - status [ref=e155]:
          - generic [ref=e156]:
            - generic [ref=e157]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: East took the trick with the king of spades and leads.
      - region "Game record" [ref=e160]:
        - generic [ref=e161]:
          - heading "Game record" [level=2] [ref=e163]
          - paragraph [ref=e164]: East took the trick with the king of spades and leads.
        - generic [ref=e165]:
          - generic [ref=e167]:
            - paragraph [ref=e168]: Deal 1
            - paragraph [ref=e169]: Pass left
          - generic [ref=e171]:
            - paragraph [ref=e172]: Deal 2
            - paragraph [ref=e173]: Pass right
          - generic [ref=e175]:
            - paragraph [ref=e176]: Deal 3
            - paragraph [ref=e177]: Pass across
          - generic [ref=e178]:
            - generic [ref=e179]:
              - paragraph [ref=e180]: Deal 4
              - paragraph [ref=e181]: No passing
            - generic [ref=e183]: Now
        - generic [ref=e185]:
          - group "Game actions" [ref=e186]:
            - button "Resign game" [ref=e187] [cursor=pointer]:
              - paragraph [ref=e190]:
                - text: Resign
                - generic [ref=e191]: game
          - button "History and stats" [ref=e192] [cursor=pointer]:
            - paragraph [ref=e195]: History and stats
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