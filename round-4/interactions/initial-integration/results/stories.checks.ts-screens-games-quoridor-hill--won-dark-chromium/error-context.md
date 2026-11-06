# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--won dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  76256 pixels (ratio 0.24 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/won-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/won-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 76256 pixels (ratio 0.24 of all image pixels) are different.
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
  - 76256 pixels (ratio 0.24 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - 'heading "Quoridor: King of the Hill" [level=1] [ref=e16]'
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e24]:
        - paragraph [ref=e29]: No moves yet.
        - button "All moves" [ref=e30] [cursor=pointer]:
          - img [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e38]:
          - list "Players" [ref=e39]:
            - listitem [ref=e40]:
              - generic [ref=e45]:
                - generic [ref=e46]: avery
                - generic [ref=e47]:
                  - generic [ref=e49]: ●
                  - generic [ref=e50]: Walls 5
                  - generic [ref=e52]: You
            - listitem [ref=e53]:
              - generic [ref=e57]:
                - generic [ref=e58]: jordan_plays
                - generic [ref=e59]:
                  - generic [ref=e61]: ◆
                  - generic [ref=e62]: Walls 5
            - listitem [ref=e63]:
              - generic [ref=e67]:
                - generic [ref=e68]: morgan
                - generic [ref=e69]:
                  - generic [ref=e71]: ▲
                  - generic [ref=e72]: Walls 5
            - listitem [ref=e73]:
              - generic [ref=e77]:
                - generic [ref=e78]: robin_42
                - generic [ref=e79]:
                  - generic [ref=e81]: ■
                  - generic [ref=e82]: Walls 5
          - generic [ref=e84]:
            - generic [ref=e85]:
              - button "Move pawn" [disabled] [pressed] [ref=e86]:
                - paragraph [ref=e89]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e90]:
                - paragraph [ref=e93]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e94]:
                - paragraph [ref=e97]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e98]:
              - generic [ref=e100]: a
              - generic [ref=e101]: b
              - generic [ref=e102]: c
              - generic [ref=e103]: d
              - generic [ref=e104]: e
              - generic [ref=e105]: f
              - generic [ref=e106]: g
              - generic [ref=e107]: h
              - generic [ref=e108]: i
              - generic [ref=e109]: "9"
              - 'button "a9: Empty" [disabled] [ref=e110]'
              - 'button "b9: Empty" [disabled] [ref=e111]'
              - 'button "c9: Empty" [disabled] [ref=e112]'
              - 'button "d9: Empty" [disabled] [ref=e113]'
              - 'button "e9: Empty" [disabled] [ref=e114]'
              - 'button "f9: Empty" [disabled] [ref=e115]'
              - 'button "g9: Empty" [disabled] [ref=e116]'
              - 'button "h9: Empty" [disabled] [ref=e117]'
              - 'button "i9: Empty" [disabled] [ref=e118]'
              - generic [ref=e119]: "8"
              - 'button "a8: Empty" [disabled] [ref=e120]'
              - 'button "b8: Empty" [disabled] [ref=e121]'
              - 'button "c8: North green triangle" [disabled] [ref=e122]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e123]'
              - 'button "e8: Empty" [disabled] [ref=e124]'
              - 'button "f8: Empty" [disabled] [ref=e125]'
              - 'button "g8: Empty" [disabled] [ref=e126]'
              - 'button "h8: Empty" [disabled] [ref=e127]'
              - 'button "i8: East black square" [disabled] [ref=e128]':
                - generic: ■
              - generic [ref=e129]: "7"
              - 'button "a7: Empty" [disabled] [ref=e130]'
              - 'button "b7: Empty" [disabled] [ref=e131]'
              - 'button "c7: Empty" [disabled] [ref=e132]'
              - 'button "d7: Empty" [disabled] [ref=e133]'
              - 'button "e7: Empty" [disabled] [ref=e134]'
              - 'button "f7: Empty" [disabled] [ref=e135]'
              - 'button "g7: Empty" [disabled] [ref=e136]'
              - 'button "h7: Empty" [disabled] [ref=e137]'
              - 'button "i7: Empty" [disabled] [ref=e138]'
              - generic [ref=e139]: "6"
              - 'button "a6: Empty" [disabled] [ref=e140]'
              - 'button "b6: Empty" [disabled] [ref=e141]'
              - 'button "c6: Empty" [disabled] [ref=e142]'
              - 'button "d6: Empty" [disabled] [ref=e143]'
              - 'button "e6: Empty" [disabled] [ref=e144]'
              - 'button "f6: Empty" [disabled] [ref=e145]'
              - 'button "g6: Empty" [disabled] [ref=e146]'
              - 'button "h6: Empty" [disabled] [ref=e147]'
              - 'button "i6: Empty" [disabled] [ref=e148]'
              - generic [ref=e149]: "5"
              - 'button "a5: Empty" [disabled] [ref=e150]'
              - 'button "b5: Empty" [disabled] [ref=e151]'
              - 'button "c5: Empty" [disabled] [ref=e152]'
              - 'button "d5: Empty" [disabled] [ref=e153]'
              - 'button "e5: South red circle" [disabled] [ref=e154]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e155]'
              - 'button "g5: Empty" [disabled] [ref=e156]'
              - 'button "h5: Empty" [disabled] [ref=e157]'
              - 'button "i5: Empty" [disabled] [ref=e158]'
              - generic [ref=e159]: "4"
              - 'button "a4: Empty" [disabled] [ref=e160]'
              - 'button "b4: Empty" [disabled] [ref=e161]'
              - 'button "c4: Empty" [disabled] [ref=e162]'
              - 'button "d4: Empty" [disabled] [ref=e163]'
              - 'button "e4: Empty" [disabled] [ref=e164]'
              - 'button "f4: Empty" [disabled] [ref=e165]'
              - 'button "g4: Empty" [disabled] [ref=e166]'
              - 'button "h4: Empty" [disabled] [ref=e167]'
              - 'button "i4: Empty" [disabled] [ref=e168]'
              - generic [ref=e169]: "3"
              - 'button "a3: Empty" [disabled] [ref=e170]'
              - 'button "b3: Empty" [disabled] [ref=e171]'
              - 'button "c3: Empty" [disabled] [ref=e172]'
              - 'button "d3: Empty" [disabled] [ref=e173]'
              - 'button "e3: Empty" [disabled] [ref=e174]'
              - 'button "f3: Empty" [disabled] [ref=e175]'
              - 'button "g3: Empty" [disabled] [ref=e176]'
              - 'button "h3: Empty" [disabled] [ref=e177]'
              - 'button "i3: Empty" [disabled] [ref=e178]'
              - generic [ref=e179]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e180]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e181]'
              - 'button "c2: Empty" [disabled] [ref=e182]'
              - 'button "d2: Empty" [disabled] [ref=e183]'
              - 'button "e2: Empty" [disabled] [ref=e184]'
              - 'button "f2: Empty" [disabled] [ref=e185]'
              - 'button "g2: Empty" [disabled] [ref=e186]'
              - 'button "h2: Empty" [disabled] [ref=e187]'
              - 'button "i2: Empty" [disabled] [ref=e188]'
              - generic [ref=e189]: "1"
              - 'button "a1: Empty" [disabled] [ref=e190]'
              - 'button "b1: Empty" [disabled] [ref=e191]'
              - 'button "c1: Empty" [disabled] [ref=e192]'
              - 'button "d1: Empty" [disabled] [ref=e193]'
              - 'button "e1: Empty" [disabled] [ref=e194]'
              - 'button "f1: Empty" [disabled] [ref=e195]'
              - 'button "g1: Empty" [disabled] [ref=e196]'
              - 'button "h1: Empty" [disabled] [ref=e197]'
              - 'button "i1: Empty" [disabled] [ref=e198]'
            - status [ref=e199]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e203]:
            - generic [ref=e204]:
              - generic [ref=e205]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e206]:
          - generic [ref=e207]:
            - heading "You win" [level=2] [ref=e209]
            - list "Standings" [ref=e210]:
              - listitem [ref=e211]:
                - generic [ref=e212]:
                  - generic [ref=e213]: 1st
                  - generic [ref=e216]: avery
              - listitem [ref=e217]:
                - generic [ref=e218]:
                  - generic [ref=e219]: 2nd
                  - generic [ref=e222]: jordan_plays
              - listitem [ref=e223]:
                - generic [ref=e224]:
                  - generic [ref=e225]: 2nd
                  - generic [ref=e228]: morgan
              - listitem [ref=e229]:
                - generic [ref=e230]:
                  - generic [ref=e231]: 2nd
                  - generic [ref=e234]: robin_42
          - generic [ref=e236]:
            - group "What next" [ref=e237]:
              - button "Rematch" [ref=e238] [cursor=pointer]:
                - paragraph [ref=e241]: Rematch
              - button "Change game" [ref=e242] [cursor=pointer]:
                - paragraph [ref=e245]: Change game
              - button "Review" [ref=e246] [cursor=pointer]:
                - paragraph [ref=e249]: Review
            - button "History and stats" [ref=e250] [cursor=pointer]:
              - generic [ref=e252]:
                - paragraph [ref=e253]: History and stats
                - img [ref=e256]
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