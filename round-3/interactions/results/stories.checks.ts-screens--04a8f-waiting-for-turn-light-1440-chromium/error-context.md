# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--waiting-for-turn light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1616 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/waiting-for-turn-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/waiting-for-turn-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1616 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1616 pixels (ratio 0.01 of all image pixels) are different.

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
            - region "East (you)" [ref=e31]:
              - generic [ref=e37]:
                - generic [ref=e38]: robin_42
                - generic [ref=e39]:
                  - generic [ref=e41]: You
                  - generic [ref=e43]: East
              - generic [ref=e44]:
                - generic [ref=e45]: 9 cards
                - generic [ref=e46]: ·Score 28
                - generic [ref=e47]: ·Taken 0
            - region "South" [ref=e48]:
              - generic [ref=e53]:
                - generic [ref=e54]: avery
                - generic [ref=e57]: South
              - generic [ref=e58]:
                - generic [ref=e59]: 8 cards
                - generic [ref=e60]: ·Score 12
                - generic [ref=e61]: ·Taken 0
            - region "West" [ref=e62]:
              - generic [ref=e67]:
                - generic [ref=e68]: jordan_plays
                - generic [ref=e71]: West
              - generic [ref=e72]:
                - generic [ref=e73]: 8 cards
                - generic [ref=e74]: ·Score 30
                - generic [ref=e75]: ·Taken 0
            - region "North" [ref=e76]:
              - generic [ref=e81]:
                - generic [ref=e82]: morgan
                - generic [ref=e85]: North
              - generic [ref=e86]:
                - generic [ref=e87]: 9 cards
                - generic [ref=e88]: ·Score 8
                - generic [ref=e89]: ·Taken 0
            - generic [ref=e90]:
              - img "3 spades, Three of spades" [ref=e93]:
                - generic [ref=e94]: 3 ♠
                - generic [ref=e95]: ♠
                - generic [ref=e96]: spades
              - img "5 spades, Five of spades" [ref=e98]:
                - generic [ref=e99]: 5 ♠
                - generic [ref=e100]: ♠
                - generic [ref=e101]: spades
            - paragraph [ref=e103]: North to play.
          - paragraph [ref=e104]: × It is not your turn to play.
          - toolbar "Your hand" [ref=e105]:
            - button "5 clubs, Five of clubs" [disabled] [ref=e106]:
              - generic [ref=e107]: 5 ♣
              - generic [ref=e108]: ♣
              - generic [ref=e109]: clubs
              - generic [ref=e110]: ×
            - button "9 clubs, Nine of clubs" [disabled] [ref=e111]:
              - generic [ref=e112]: 9 ♣
              - generic [ref=e113]: ♣
              - generic [ref=e114]: clubs
              - generic [ref=e115]: ×
            - button "J clubs, Jack of clubs" [disabled] [ref=e116]:
              - generic [ref=e117]: J ♣
              - generic [ref=e118]: ♣
              - generic [ref=e119]: clubs
              - generic [ref=e120]: ×
            - button "5 diamonds, Five of diamonds" [disabled] [ref=e121]:
              - generic [ref=e122]: 5 ♦
              - generic [ref=e123]: ♦
              - generic [ref=e124]: diamonds
              - generic [ref=e125]: ×
            - button "A diamonds, Ace of diamonds" [disabled] [ref=e126]:
              - generic [ref=e127]: A ♦
              - generic [ref=e128]: ♦
              - generic [ref=e129]: diamonds
              - generic [ref=e130]: ×
            - button "K spades, King of spades" [disabled] [ref=e131]:
              - generic [ref=e132]: K ♠
              - generic [ref=e133]: ♠
              - generic [ref=e134]: spades
              - generic [ref=e135]: ×
            - button "10 hearts, Ten of hearts" [disabled] [ref=e136]:
              - generic [ref=e137]: 10 ♥
              - generic [ref=e138]: ♥
              - generic [ref=e139]: hearts
              - generic [ref=e140]: ×
            - button "K hearts, King of hearts" [disabled] [ref=e141]:
              - generic [ref=e142]: K ♥
              - generic [ref=e143]: ♥
              - generic [ref=e144]: hearts
              - generic [ref=e145]: ×
            - button "A hearts, Ace of hearts" [disabled] [ref=e146]:
              - generic [ref=e147]: A ♥
              - generic [ref=e148]: ♥
              - generic [ref=e149]: hearts
              - generic [ref=e150]: ×
          - status
        - status [ref=e152]:
          - generic [ref=e153]:
            - generic [ref=e154]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
            - text: North to play.
      - region "Game record" [ref=e157]:
        - generic [ref=e158]:
          - heading "Game record" [level=2] [ref=e160]
          - paragraph [ref=e161]: North to play.
        - generic [ref=e162]:
          - generic [ref=e164]:
            - paragraph [ref=e165]: Deal 1
            - paragraph [ref=e166]: Pass left
          - generic [ref=e168]:
            - paragraph [ref=e169]: Deal 2
            - paragraph [ref=e170]: Pass right
          - generic [ref=e172]:
            - paragraph [ref=e173]: Deal 3
            - paragraph [ref=e174]: Pass across
          - generic [ref=e175]:
            - generic [ref=e176]:
              - paragraph [ref=e177]: Deal 4
              - paragraph [ref=e178]: No passing
            - generic [ref=e180]: Now
        - generic [ref=e182]:
          - group "Game actions" [ref=e183]:
            - button "Resign game" [ref=e184] [cursor=pointer]:
              - paragraph [ref=e187]:
                - text: Resign
                - generic [ref=e188]: game
          - button "History and stats" [ref=e189] [cursor=pointer]:
            - paragraph [ref=e192]: History and stats
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