# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> product-cardtable--states light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  Expected an image 390px by 773px, received 390px by 795px. 46957 pixels (ratio 0.16 of all image pixels) are different.

  Snapshot: pkgs/ui-root-client-ts/src/card-table/baselines/chromium/product-cardtable/states-light.png

Call log:
  - Expect "toHaveScreenshot(pkgs/ui-root-client-ts/src/card-table/baselines/chromium/product-cardtable/states-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 390px by 773px, received 390px by 795px. 46957 pixels (ratio 0.16 of all image pixels) are different.
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
  - Expected an image 390px by 773px, received 390px by 795px. 46957 pixels (ratio 0.16 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - group "Card table" [ref=e7]:
      - region "North" [ref=e8]:
        - generic [ref=e10]:
          - img [ref=e13]
          - generic [ref=e16]:
            - generic [ref=e17]: morgan
            - generic [ref=e21]: North
        - generic [ref=e22]:
          - generic [ref=e23]: 13 cards
          - generic [ref=e24]: 12 points
          - generic [ref=e25]: Passed
      - region "West" [ref=e26]:
        - generic [ref=e27]: West
        - generic [ref=e28]:
          - generic [ref=e29]: 13 cards
          - generic [ref=e30]: 0 points
      - region "East" [ref=e31]:
        - generic [ref=e32]: East
        - generic [ref=e33]:
          - generic [ref=e34]: 13 cards
          - generic [ref=e35]: 26 points
      - region "South (you)" [ref=e36]:
        - generic [ref=e37]: South (you)
        - generic [ref=e38]:
          - generic [ref=e39]: 13 cards
          - generic [ref=e40]: 3 points
      - text: ♣
      - generic [ref=e42]: Passing to the left
      - paragraph [ref=e47]: Choose three cards to pass
    - paragraph [ref=e48]: × You keep the two of clubs.
    - toolbar "Your hand" [ref=e49]:
      - button "2 clubs, Two of clubs" [disabled] [ref=e50]:
        - generic [ref=e51]: 2 ♣
        - generic [ref=e52]: ♣
        - generic [ref=e53]: clubs
        - generic [ref=e54]: ×
      - button "9 diamonds, Nine of diamonds" [ref=e55] [cursor=pointer]:
        - generic [ref=e56]: 9 ♦
        - generic [ref=e57]: ♦
        - generic [ref=e58]: diamonds
      - button "Q spades, Queen of spades" [ref=e59] [cursor=pointer]:
        - generic [ref=e60]: Q ♠
        - generic [ref=e61]: ♠
        - generic [ref=e62]: spades
      - button "A spades, Ace of spades" [ref=e63] [cursor=pointer]:
        - generic [ref=e64]: A ♠
        - generic [ref=e65]: ♠
        - generic [ref=e66]: spades
      - button "5 hearts, Five of hearts" [ref=e67] [cursor=pointer]:
        - generic [ref=e68]: 5 ♥
        - generic [ref=e69]: ♥
        - generic [ref=e70]: hearts
      - button "K hearts, King of hearts" [ref=e71] [cursor=pointer]:
        - generic [ref=e72]: K ♥
        - generic [ref=e73]: ♥
        - generic [ref=e74]: hearts
    - status
    - generic [ref=e75]:
      - paragraph [ref=e76]: 0 of 3 chosen
      - button "Pass left" [disabled] [ref=e77]:
        - paragraph [ref=e80]: Pass left
  - generic [ref=e81]:
    - group "Card table, playing" [ref=e82]:
      - paragraph [ref=e83]: Spades led. 1 played.
    - paragraph [ref=e84]: × You must follow suit with a spade.
    - toolbar "Your hand" [ref=e85]:
      - button "2 clubs, Two of clubs" [disabled] [ref=e86]:
        - generic [ref=e87]: 2 ♣
        - generic [ref=e88]: ♣
        - generic [ref=e89]: clubs
        - generic [ref=e90]: ×
      - button "9 diamonds, Nine of diamonds" [disabled] [ref=e91]:
        - generic [ref=e92]: 9 ♦
        - generic [ref=e93]: ♦
        - generic [ref=e94]: diamonds
        - generic [ref=e95]: ×
      - button "A spades, Ace of spades" [active] [ref=e96] [cursor=pointer]:
        - generic [ref=e97]: A ♠
        - generic [ref=e98]: ♠
        - generic [ref=e99]: spades
      - button "5 hearts, Five of hearts" [disabled] [ref=e100]:
        - generic [ref=e101]: 5 ♥
        - generic [ref=e102]: ♥
        - generic [ref=e103]: hearts
        - generic [ref=e104]: ×
      - button "K hearts, King of hearts" [disabled] [ref=e105]:
        - generic [ref=e106]: K ♥
        - generic [ref=e107]: ♥
        - generic [ref=e108]: hearts
        - generic [ref=e109]: ×
    - status
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