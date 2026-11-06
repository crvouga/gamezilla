# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--must-pass dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  166104 pixels (ratio 0.14 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/must-pass-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 166104 pixels (ratio 0.14 of all image pixels) are different.
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
  - 166104 pixels (ratio 0.14 of all image pixels) are different.

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
        - list "Other players" [ref=e28]:
          - listitem [ref=e29]:
            - generic [ref=e33]:
              - generic [ref=e34]: jordan_plays
              - generic [ref=e35]:
                - generic [ref=e37]: ◆
                - generic [ref=e38]: Walls 3
          - listitem [ref=e39]:
            - generic [ref=e43]:
              - generic [ref=e44]: morgan
              - generic [ref=e45]:
                - generic [ref=e47]: ▲
                - generic [ref=e48]: Walls 4
          - listitem [ref=e49]:
            - generic [ref=e53]:
              - generic [ref=e54]: robin_42
              - generic [ref=e55]:
                - generic [ref=e57]: ■
                - generic [ref=e58]: Walls 1
        - generic [ref=e60]:
          - button "No legal move or wall — pass turn" [ref=e62] [cursor=pointer]:
            - paragraph [ref=e65]: No legal move or wall — pass turn
          - group "Quoridor board, nine columns and nine rows" [ref=e66]:
            - generic [ref=e68]: a
            - generic [ref=e69]: b
            - generic [ref=e70]: c
            - generic [ref=e71]: d
            - generic [ref=e72]: e
            - generic [ref=e73]: f
            - generic [ref=e74]: g
            - generic [ref=e75]: h
            - generic [ref=e76]: i
            - generic [ref=e77]: "9"
            - 'button "a9: Empty" [disabled] [ref=e78]'
            - 'button "b9: Empty" [disabled] [ref=e79]'
            - 'button "c9: Empty" [disabled] [ref=e80]'
            - 'button "d9: Empty" [disabled] [ref=e81]'
            - 'button "e9: Empty" [disabled] [ref=e82]'
            - 'button "f9: Empty" [disabled] [ref=e83]'
            - 'button "g9: Empty" [disabled] [ref=e84]'
            - 'button "h9: Empty" [disabled] [ref=e85]'
            - 'button "i9: Empty" [disabled] [ref=e86]'
            - generic [ref=e87]: "8"
            - 'button "a8: Empty, wall boundaries: right" [disabled] [ref=e88]'
            - 'button "b8: Empty, wall boundaries: left" [disabled] [ref=e89]'
            - 'button "c8: Empty, wall boundaries: bottom" [disabled] [ref=e90]'
            - 'button "d8: Empty, wall boundaries: bottom" [disabled] [ref=e91]'
            - 'button "e8: Empty" [disabled] [ref=e92]'
            - 'button "f8: Empty, wall boundaries: bottom" [disabled] [ref=e93]'
            - 'button "g8: Empty, wall boundaries: bottom" [disabled] [ref=e94]'
            - 'button "h8: Empty" [disabled] [ref=e95]'
            - 'button "i8: Empty" [disabled] [ref=e96]'
            - generic [ref=e97]: "7"
            - 'button "a7: Empty, wall boundaries: right" [disabled] [ref=e98]'
            - 'button "b7: Empty, wall boundaries: left" [disabled] [ref=e99]'
            - 'button "c7: Empty, wall boundaries: top" [disabled] [ref=e100]'
            - 'button "d7: Empty, wall boundaries: top" [disabled] [ref=e101]'
            - 'button "e7: Empty" [disabled] [ref=e102]'
            - 'button "f7: Empty, wall boundaries: top" [disabled] [ref=e103]'
            - 'button "g7: Empty, wall boundaries: top" [disabled] [ref=e104]'
            - 'button "h7: Empty" [disabled] [ref=e105]'
            - 'button "i7: Empty" [disabled] [ref=e106]'
            - generic [ref=e107]: "6"
            - 'button "a6: Empty, wall boundaries: right" [disabled] [ref=e108]'
            - 'button "b6: Empty, wall boundaries: left" [disabled] [ref=e109]'
            - 'button "c6: Empty, wall boundaries: bottom" [disabled] [ref=e110]'
            - 'button "d6: Empty, wall boundaries: bottom" [disabled] [ref=e111]'
            - 'button "e6: Empty" [disabled] [ref=e112]'
            - 'button "f6: Empty" [disabled] [ref=e113]'
            - 'button "g6: Empty" [disabled] [ref=e114]'
            - 'button "h6: Empty" [disabled] [ref=e115]'
            - 'button "i6: Empty" [disabled] [ref=e116]'
            - generic [ref=e117]: "5"
            - 'button "a5: Empty, wall boundaries: right" [disabled] [ref=e118]'
            - 'button "b5: Empty, wall boundaries: left" [disabled] [ref=e119]'
            - 'button "c5: Empty, wall boundaries: top" [disabled] [ref=e120]'
            - 'button "d5: Empty, wall boundaries: top" [disabled] [ref=e121]'
            - 'button "e5: Central hill" [disabled] [ref=e122]':
              - generic: ◎
            - 'button "f5: Empty" [disabled] [ref=e123]'
            - 'button "g5: Empty" [disabled] [ref=e124]'
            - 'button "h5: Empty" [disabled] [ref=e125]'
            - 'button "i5: East black square" [disabled] [ref=e126]':
              - generic: ■
            - generic [ref=e127]: "4"
            - 'button "a4: Empty, wall boundaries: bottom" [disabled] [ref=e128]'
            - 'button "b4: Empty, wall boundaries: bottom" [disabled] [ref=e129]'
            - 'button "c4: Empty" [disabled] [ref=e130]'
            - 'button "d4: Empty" [disabled] [ref=e131]'
            - 'button "e4: North green triangle" [disabled] [ref=e132]':
              - generic: ▲
            - 'button "f4: Empty" [disabled] [ref=e133]'
            - 'button "g4: Empty, wall boundaries: bottom" [disabled] [ref=e134]'
            - 'button "h4: Empty, wall boundaries: bottom" [disabled] [ref=e135]'
            - 'button "i4: Empty" [disabled] [ref=e136]'
            - generic [ref=e137]: "3"
            - 'button "a3: Empty, wall boundaries: top" [disabled] [ref=e138]'
            - 'button "b3: Empty, wall boundaries: top" [disabled] [ref=e139]'
            - 'button "c3: Empty" [disabled] [ref=e140]'
            - 'button "d3: Empty, wall boundaries: right" [disabled] [ref=e141]'
            - 'button "e3: West gold diamond, wall boundaries: left, right" [disabled] [ref=e142]':
              - generic: ◆
            - 'button "f3: Empty, wall boundaries: left" [disabled] [ref=e143]'
            - 'button "g3: Empty, wall boundaries: top" [disabled] [ref=e144]'
            - 'button "h3: Empty, wall boundaries: top" [disabled] [ref=e145]'
            - 'button "i3: Empty" [disabled] [ref=e146]'
            - generic [ref=e147]: "2"
            - 'button "a2: Empty, wall boundaries: bottom" [disabled] [ref=e148]'
            - 'button "b2: Empty, wall boundaries: bottom" [disabled] [ref=e149]'
            - 'button "c2: Empty" [disabled] [ref=e150]'
            - 'button "d2: Empty, wall boundaries: right, bottom" [disabled] [ref=e151]'
            - 'button "e2: South red circle, wall boundaries: left, right, bottom" [disabled] [ref=e152]':
              - generic: ●
            - 'button "f2: Empty, wall boundaries: left" [disabled] [ref=e153]'
            - 'button "g2: Empty, wall boundaries: bottom" [disabled] [ref=e154]'
            - 'button "h2: Empty, wall boundaries: bottom" [disabled] [ref=e155]'
            - 'button "i2: Empty" [disabled] [ref=e156]'
            - generic [ref=e157]: "1"
            - 'button "a1: Empty, wall boundaries: top" [disabled] [ref=e158]'
            - 'button "b1: Empty, wall boundaries: top" [disabled] [ref=e159]'
            - 'button "c1: Empty" [disabled] [ref=e160]'
            - 'button "d1: Empty, wall boundaries: top" [disabled] [ref=e161]'
            - 'button "e1: Empty, wall boundaries: top" [disabled] [ref=e162]'
            - 'button "f1: Empty" [disabled] [ref=e163]'
            - 'button "g1: Empty, wall boundaries: top" [disabled] [ref=e164]'
            - 'button "h1: Empty, wall boundaries: top" [disabled] [ref=e165]'
            - 'button "i1: Empty" [disabled] [ref=e166]'
          - status [ref=e167]: No legal move or wall. Pass to continue.
        - status [ref=e169]:
          - generic [ref=e170]:
            - generic [ref=e171]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
            - text: Your turn. First to e5 wins.
        - generic [ref=e174]:
          - generic [ref=e179]:
            - img "South red circle" [ref=e180]:
              - generic [ref=e181]: ●
            - generic [ref=e182]: avery
            - generic [ref=e183]: Your move
          - generic [ref=e184]:
            - generic [ref=e185]: Walls
            - generic [ref=e186]: "0"
      - region "Game record" [ref=e189]:
        - generic [ref=e190]:
          - heading "Game record" [level=2] [ref=e192]
          - paragraph [ref=e193]: Your turn. First to e5 wins.
        - generic [ref=e195]:
          - group "Game actions" [ref=e196]:
            - button "Offer draw" [ref=e197] [cursor=pointer]:
              - paragraph [ref=e200]: Offer draw
            - button "Resign game" [ref=e201] [cursor=pointer]:
              - paragraph [ref=e204]:
                - text: Resign
                - generic [ref=e205]: game
          - button "History and stats" [ref=e206] [cursor=pointer]:
            - paragraph [ref=e209]: History and stats
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