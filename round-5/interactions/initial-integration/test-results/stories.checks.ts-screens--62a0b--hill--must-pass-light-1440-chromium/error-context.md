# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--must-pass light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  68869 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 68869 pixels (ratio 0.06 of all image pixels) are different.
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
  - 68869 pixels (ratio 0.06 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e19]'
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - list "Other players" [ref=e29]:
          - generic "jordan_plays" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e35]:
                - generic [ref=e36]: jordan_plays
                - generic [ref=e37]:
                  - generic [ref=e39]: ◆
                  - generic [ref=e40]: Walls 3
          - generic "morgan" [ref=e41]:
            - listitem [ref=e42]:
              - generic [ref=e46]:
                - generic [ref=e47]: morgan
                - generic [ref=e48]:
                  - generic [ref=e50]: ▲
                  - generic [ref=e51]: Walls 4
          - generic "robin_42" [ref=e52]:
            - listitem [ref=e53]:
              - generic [ref=e57]:
                - generic [ref=e58]: robin_42
                - generic [ref=e59]:
                  - generic [ref=e61]: ■
                  - generic [ref=e62]: Walls 1
        - generic [ref=e64]:
          - button "No legal move or wall — pass turn" [ref=e66] [cursor=pointer]:
            - paragraph [ref=e69]: No legal move or wall — pass turn
          - group "Quoridor board, nine columns and nine rows" [ref=e70]:
            - generic [ref=e72]: a
            - generic [ref=e73]: b
            - generic [ref=e74]: c
            - generic [ref=e75]: d
            - generic [ref=e76]: e
            - generic [ref=e77]: f
            - generic [ref=e78]: g
            - generic [ref=e79]: h
            - generic [ref=e80]: i
            - generic [ref=e81]: "9"
            - 'button "a9: Empty" [disabled] [ref=e82]'
            - 'button "b9: Empty" [disabled] [ref=e83]'
            - 'button "c9: Empty" [disabled] [ref=e84]'
            - 'button "d9: Empty" [disabled] [ref=e85]'
            - 'button "e9: Empty" [disabled] [ref=e86]'
            - 'button "f9: Empty" [disabled] [ref=e87]'
            - 'button "g9: Empty" [disabled] [ref=e88]'
            - 'button "h9: Empty" [disabled] [ref=e89]'
            - 'button "i9: Empty" [disabled] [ref=e90]'
            - generic [ref=e91]: "8"
            - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e92]'
            - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e93]'
            - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e94]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e95]'
            - 'button "e8: Empty" [disabled] [ref=e96]'
            - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e97]'
            - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e98]'
            - 'button "h8: Empty" [disabled] [ref=e99]'
            - 'button "i8: Empty" [disabled] [ref=e100]'
            - generic [ref=e101]: "7"
            - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e102]'
            - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e103]'
            - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e104]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e105]'
            - 'button "e7: Empty" [disabled] [ref=e106]'
            - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e107]'
            - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e108]'
            - 'button "h7: Empty" [disabled] [ref=e109]'
            - 'button "i7: Empty" [disabled] [ref=e110]'
            - generic [ref=e111]: "6"
            - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e112]'
            - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e113]'
            - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e114]'
            - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e115]'
            - 'button "e6: Empty" [disabled] [ref=e116]'
            - 'button "f6: Empty" [disabled] [ref=e117]'
            - 'button "g6: Empty" [disabled] [ref=e118]'
            - 'button "h6: Empty" [disabled] [ref=e119]'
            - 'button "i6: Empty" [disabled] [ref=e120]'
            - generic [ref=e121]: "5"
            - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e122]'
            - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e123]'
            - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e124]'
            - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e125]'
            - 'button "e5: Central hill, center goal" [disabled] [ref=e126]':
              - generic: ★
            - 'button "f5: Empty" [disabled] [ref=e127]'
            - 'button "g5: Empty" [disabled] [ref=e128]'
            - 'button "h5: Empty" [disabled] [ref=e129]'
            - 'button "i5: East black square" [disabled] [ref=e130]':
              - generic: ■
            - generic [ref=e131]: "4"
            - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e132]'
            - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e133]'
            - 'button "c4: Empty" [disabled] [ref=e134]'
            - 'button "d4: Empty" [disabled] [ref=e135]'
            - 'button "e4: North green triangle" [disabled] [ref=e136]':
              - generic: ▲
            - 'button "f4: Empty" [disabled] [ref=e137]'
            - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e138]'
            - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e139]'
            - 'button "i4: Empty" [disabled] [ref=e140]'
            - generic [ref=e141]: "3"
            - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e142]'
            - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e143]'
            - 'button "c3: Empty" [disabled] [ref=e144]'
            - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e145]'
            - 'button "e3: West gold diamond, wall boundaries: left, right" [disabled] [ref=e146]':
              - generic: ◆
            - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e147]'
            - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e148]'
            - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e149]'
            - 'button "i3: Empty" [disabled] [ref=e150]'
            - generic [ref=e151]: "2"
            - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e152]'
            - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e153]'
            - 'button "c2: Empty" [disabled] [ref=e154]'
            - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e155]'
            - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e156]':
              - generic: ●
            - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e157]'
            - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e158]'
            - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e159]'
            - 'button "i2: Empty" [disabled] [ref=e160]'
            - generic [ref=e161]: "1"
            - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e162]'
            - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e163]'
            - 'button "c1: Empty" [disabled] [ref=e164]'
            - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e165]'
            - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e166]'
            - 'button "f1: Empty" [disabled] [ref=e167]'
            - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e168]'
            - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e169]'
            - 'button "i1: Empty" [disabled] [ref=e170]'
          - status [ref=e171]: No legal move or wall. Pass to continue.
        - status [ref=e173]:
          - generic [ref=e174]:
            - generic [ref=e175]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: Your turn. Reach the center hill (e5) first.
        - generic [ref=e178]:
          - generic [ref=e183]:
            - img "South red circle" [ref=e184]:
              - generic [ref=e185]: ●
            - generic "avery" [ref=e188]
            - generic [ref=e189]: Your move
          - generic [ref=e190]:
            - generic [ref=e191]: Walls
            - generic [ref=e192]: "0"
      - region "Game record" [ref=e195]:
        - generic [ref=e196]:
          - heading "Game record" [level=2] [ref=e198]
          - paragraph [ref=e199]: Your turn. Reach the center hill (e5) first.
        - generic [ref=e201]:
          - group "Game actions" [ref=e202]:
            - button "Offer draw" [ref=e203] [cursor=pointer]:
              - paragraph [ref=e206]: Offer draw
            - button "Resign game" [ref=e207] [cursor=pointer]:
              - paragraph [ref=e210]:
                - text: Resign
                - generic [ref=e211]: game
          - button "History and stats" [ref=e212] [cursor=pointer]:
            - paragraph [ref=e215]: History and stats
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