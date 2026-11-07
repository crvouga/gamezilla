# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-pong-court--finished light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  185106 pixels (ratio 0.16 of all image pixels) are different.

  Snapshot: libs/pong-client-ts/src/baselines/chromium/screens-games-pong-court/finished-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/pong-client-ts/src/baselines/chromium/screens-games-pong-court/finished-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 185106 pixels (ratio 0.16 of all image pixels) are different.
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
  - 185106 pixels (ratio 0.16 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Pong" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "jordan_plays wins" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e46]:
            - generic [ref=e47]: Left 0 Right 3
            - generic [ref=e48]:
              - generic [ref=e49]:
                - generic [ref=e50]:
                  - generic [ref=e51]: "0"
                  - generic [ref=e52]: You
                - generic [ref=e53]:
                  - generic [ref=e54]: "3"
                  - generic [ref=e55]: jordan_plays
              - application "Pong court" [ref=e57]:
                - img [ref=e58]
                - status: Right wins.
            - paragraph [ref=e63]: First to 3 · Match finished.
          - status [ref=e65]:
            - generic [ref=e66]:
              - generic [ref=e67]: "Left: avery. Right: jordan_plays."
              - text: The score target was reached.
        - list "Standings" [ref=e70]:
          - listitem [ref=e71]:
            - generic [ref=e72]:
              - generic [ref=e73]: 1st
              - generic [ref=e76]: jordan_plays
              - generic [ref=e77]:
                - generic [ref=e78]: Points
                - text: "3"
          - listitem [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e81]: 2nd
              - generic [ref=e84]: avery
              - generic [ref=e85]:
                - generic [ref=e86]: Points
                - text: "0"
        - region "Players" [ref=e88]:
          - generic [ref=e89]:
            - heading "Players" [level=2] [ref=e91]
            - paragraph [ref=e92]: The score target was reached.
          - generic [ref=e93]:
            - generic [ref=e100]:
              - img "Left" [ref=e101]
              - generic "avery" [ref=e104]
              - generic [ref=e107]: You
            - generic [ref=e114]:
              - img "Right" [ref=e115]
              - generic "jordan_plays" [ref=e118]
          - button "History and stats" [ref=e121] [cursor=pointer]:
            - paragraph [ref=e124]: History and stats
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