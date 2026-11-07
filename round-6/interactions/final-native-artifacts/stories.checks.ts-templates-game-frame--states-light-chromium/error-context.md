# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> templates-game-frame--states light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  518 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: pkgs/ui-root-client-ts/src/game-session-layout/baselines/chromium/templates-game-frame/states-light.png

Call log:
  - Expect "toHaveScreenshot(pkgs/ui-root-client-ts/src/game-session-layout/baselines/chromium/templates-game-frame/states-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 518 pixels (ratio 0.01 of all image pixels) are different.
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
  - 518 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e8]:
  - heading "Game frame" [level=1] [ref=e10]
  - generic [ref=e11]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]:
          - img [ref=e17]
          - generic [ref=e20]: 12.4K
        - generic [ref=e21]: 12,400 watching
      - button "Change game" [ref=e22] [cursor=pointer]:
        - paragraph [ref=e25]: Change game
    - generic [ref=e27]:
      - generic [ref=e28]:
        - generic [ref=e31]:
          - img [ref=e34]
          - generic [ref=e38]:
            - generic [ref=e40]: ●
            - generic [ref=e41]: You
        - generic [ref=e44]:
          - img [ref=e46]:
            - img [ref=e48]
          - generic [ref=e52]:
            - generic [ref=e54]: ◆
            - generic [ref=e55]: Stockfish
        - generic [ref=e58]:
          - img [ref=e60]:
            - img [ref=e61]
            - img [ref=e66]
          - generic [ref=e70]:
            - generic [ref=e72]: ▲
            - generic [ref=e73]: Guest 4821
        - generic [ref=e76]:
          - img [ref=e78]
          - generic [ref=e80]:
            - generic [ref=e82]: ■
            - generic [ref=e83]: Open seat
        - generic [ref=e85]:
          - generic [ref=e86]:
            - generic [ref=e87]: Points to win
            - generic [ref=e88]:
              - button "Decrease Points to win" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
              - spinbutton "Points to win" [ref=e91]: "11"
              - button "Increase Points to win" [ref=e92] [cursor=pointer]:
                - img [ref=e93]
          - paragraph [ref=e95]: From 1 to 99
      - group "Actions" [ref=e97]:
        - button "Start game" [ref=e98] [cursor=pointer]:
          - paragraph [ref=e101]: Start game
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