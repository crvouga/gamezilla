# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--reach-opposite-edge light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  35761 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/reach-opposite-edge-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/reach-opposite-edge-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 35761 pixels (ratio 0.03 of all image pixels) are different.
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
  - 35761 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Classic Quoridor" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e34]:
            - img "North gold diamond" [ref=e35]:
              - generic [ref=e36]: ◆
            - generic [ref=e37]: jordan_plays
          - generic [ref=e38]:
            - generic [ref=e39]: Walls
            - generic [ref=e40]: "10"
        - generic [ref=e42]:
          - generic [ref=e43]:
            - button "Move pawn" [disabled] [pressed] [ref=e44]:
              - paragraph [ref=e47]: Move pawn
            - button "Horizontal wall" [disabled] [ref=e48]:
              - paragraph [ref=e51]: Wall across
            - button "Vertical wall" [disabled] [ref=e52]:
              - paragraph [ref=e55]: Wall down
          - group "Quoridor board, nine columns and nine rows" [ref=e56]:
            - generic [ref=e58]: a
            - generic [ref=e59]: b
            - generic [ref=e60]: c
            - generic [ref=e61]: d
            - generic [ref=e62]: e
            - generic [ref=e63]: f
            - generic [ref=e64]: g
            - generic [ref=e65]: h
            - generic [ref=e66]: i
            - generic [ref=e67]: "9"
            - 'button "a9: Empty" [disabled] [ref=e68]'
            - 'button "b9: Empty" [disabled] [ref=e69]'
            - 'button "c9: Empty" [disabled] [ref=e70]'
            - 'button "d9: Empty" [disabled] [ref=e71]'
            - 'button "e9: South red circle" [disabled] [active] [ref=e72]':
              - generic: ●
            - 'button "f9: Empty" [disabled] [ref=e73]'
            - 'button "g9: Empty" [disabled] [ref=e74]'
            - 'button "h9: Empty" [disabled] [ref=e75]'
            - 'button "i9: Empty" [disabled] [ref=e76]'
            - generic [ref=e77]: "8"
            - 'button "a8: Empty" [disabled] [ref=e78]'
            - 'button "b8: Empty" [disabled] [ref=e79]'
            - 'button "c8: Empty" [disabled] [ref=e80]'
            - 'button "d8: Empty" [disabled] [ref=e81]'
            - 'button "e8: Empty" [disabled] [ref=e82]'
            - 'button "f8: Empty" [disabled] [ref=e83]'
            - 'button "g8: Empty" [disabled] [ref=e84]'
            - 'button "h8: Empty" [disabled] [ref=e85]'
            - 'button "i8: Empty" [disabled] [ref=e86]'
            - generic [ref=e87]: "7"
            - 'button "a7: Empty" [disabled] [ref=e88]'
            - 'button "b7: Empty" [disabled] [ref=e89]'
            - 'button "c7: Empty" [disabled] [ref=e90]'
            - 'button "d7: Empty" [disabled] [ref=e91]'
            - 'button "e7: Empty" [disabled] [ref=e92]'
            - 'button "f7: Empty" [disabled] [ref=e93]'
            - 'button "g7: Empty" [disabled] [ref=e94]'
            - 'button "h7: Empty" [disabled] [ref=e95]'
            - 'button "i7: Empty" [disabled] [ref=e96]'
            - generic [ref=e97]: "6"
            - 'button "a6: North gold diamond" [disabled] [ref=e98]':
              - generic: ◆
            - 'button "b6: Empty" [disabled] [ref=e99]'
            - 'button "c6: Empty" [disabled] [ref=e100]'
            - 'button "d6: Empty" [disabled] [ref=e101]'
            - 'button "e6: Empty" [disabled] [ref=e102]'
            - 'button "f6: Empty" [disabled] [ref=e103]'
            - 'button "g6: Empty" [disabled] [ref=e104]'
            - 'button "h6: Empty" [disabled] [ref=e105]'
            - 'button "i6: Empty" [disabled] [ref=e106]'
            - generic [ref=e107]: "5"
            - 'button "a5: Empty" [disabled] [ref=e108]'
            - 'button "b5: Empty" [disabled] [ref=e109]'
            - 'button "c5: Empty" [disabled] [ref=e110]'
            - 'button "d5: Empty" [disabled] [ref=e111]'
            - 'button "e5: Empty" [disabled] [ref=e112]'
            - 'button "f5: Empty" [disabled] [ref=e113]'
            - 'button "g5: Empty" [disabled] [ref=e114]'
            - 'button "h5: Empty" [disabled] [ref=e115]'
            - 'button "i5: Empty" [disabled] [ref=e116]'
            - generic [ref=e117]: "4"
            - 'button "a4: Empty" [disabled] [ref=e118]'
            - 'button "b4: Empty" [disabled] [ref=e119]'
            - 'button "c4: Empty" [disabled] [ref=e120]'
            - 'button "d4: Empty" [disabled] [ref=e121]'
            - 'button "e4: Empty" [disabled] [ref=e122]'
            - 'button "f4: Empty" [disabled] [ref=e123]'
            - 'button "g4: Empty" [disabled] [ref=e124]'
            - 'button "h4: Empty" [disabled] [ref=e125]'
            - 'button "i4: Empty" [disabled] [ref=e126]'
            - generic [ref=e127]: "3"
            - 'button "a3: Empty" [disabled] [ref=e128]'
            - 'button "b3: Empty" [disabled] [ref=e129]'
            - 'button "c3: Empty" [disabled] [ref=e130]'
            - 'button "d3: Empty" [disabled] [ref=e131]'
            - 'button "e3: Empty" [disabled] [ref=e132]'
            - 'button "f3: Empty" [disabled] [ref=e133]'
            - 'button "g3: Empty" [disabled] [ref=e134]'
            - 'button "h3: Empty" [disabled] [ref=e135]'
            - 'button "i3: Empty" [disabled] [ref=e136]'
            - generic [ref=e137]: "2"
            - 'button "a2: Empty" [disabled] [ref=e138]'
            - 'button "b2: Empty" [disabled] [ref=e139]'
            - 'button "c2: Empty" [disabled] [ref=e140]'
            - 'button "d2: Empty" [disabled] [ref=e141]'
            - 'button "e2: Empty" [disabled] [ref=e142]'
            - 'button "f2: Empty" [disabled] [ref=e143]'
            - 'button "g2: Empty" [disabled] [ref=e144]'
            - 'button "h2: Empty" [disabled] [ref=e145]'
            - 'button "i2: Empty" [disabled] [ref=e146]'
            - generic [ref=e147]: "1"
            - 'button "a1: Empty" [disabled] [ref=e148]'
            - 'button "b1: Empty" [disabled] [ref=e149]'
            - 'button "c1: Empty" [disabled] [ref=e150]'
            - 'button "d1: Empty" [disabled] [ref=e151]'
            - 'button "e1: Empty" [disabled] [ref=e152]'
            - 'button "f1: Empty" [disabled] [ref=e153]'
            - 'button "g1: Empty" [disabled] [ref=e154]'
            - 'button "h1: Empty" [disabled] [ref=e155]'
            - 'button "i1: Empty" [disabled] [ref=e156]'
          - status [ref=e157]: Game finished. Use the game controls to review earlier moves.
        - status [ref=e159]:
          - generic [ref=e160]:
            - generic [ref=e161]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: South red circle to move.
        - generic [ref=e164]:
          - generic [ref=e169]:
            - img "South red circle" [ref=e170]:
              - generic [ref=e171]: ●
            - generic [ref=e172]: avery
            - generic [ref=e173]: Your move
          - generic [ref=e174]:
            - generic [ref=e175]: Walls
            - generic [ref=e176]: "10"
      - region "Game record" [ref=e179]:
        - generic [ref=e180]:
          - heading "Game record" [level=2] [ref=e182]
          - paragraph [ref=e183]: South red circle to move.
        - generic [ref=e185]:
          - group "Game actions" [ref=e186]:
            - button "Offer draw" [ref=e187] [cursor=pointer]:
              - paragraph [ref=e190]: Offer draw
            - button "Resign game" [ref=e191] [cursor=pointer]:
              - paragraph [ref=e194]:
                - text: Resign
                - generic [ref=e195]: game
          - button "History and stats" [ref=e196] [cursor=pointer]:
            - paragraph [ref=e199]: History and stats
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