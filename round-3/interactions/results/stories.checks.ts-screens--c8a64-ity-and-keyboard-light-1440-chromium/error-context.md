# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--pawn-identity-and-keyboard light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  4742 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/pawn-identity-and-keyboard-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/pawn-identity-and-keyboard-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 4742 pixels (ratio 0.01 of all image pixels) are different.
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
  - 4742 pixels (ratio 0.01 of all image pixels) are different.

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
          - group "Quoridor board, nine columns and nine rows" [ref=e43]:
            - generic [ref=e45]: a
            - generic [ref=e46]: b
            - generic [ref=e47]: c
            - generic [ref=e48]: d
            - generic [ref=e49]: e
            - generic [ref=e50]: f
            - generic [ref=e51]: g
            - generic [ref=e52]: h
            - generic [ref=e53]: i
            - generic [ref=e54]: "9"
            - 'button "a9: Empty" [disabled] [ref=e55]'
            - 'button "b9: Empty" [disabled] [ref=e56]'
            - 'button "c9: Empty" [disabled] [ref=e57]'
            - 'button "d9: Empty, legal move" [ref=e58] [cursor=pointer]':
              - generic: ·
            - 'button "e9: North gold diamond" [disabled] [ref=e59]':
              - generic: ◆
            - 'button "f9: Empty, legal move" [ref=e60] [cursor=pointer]':
              - generic: ·
            - 'button "g9: Empty" [disabled] [ref=e61]'
            - 'button "h9: Empty" [disabled] [ref=e62]'
            - 'button "i9: Empty" [disabled] [ref=e63]'
            - generic [ref=e64]: "8"
            - 'button "a8: Empty" [disabled] [ref=e65]'
            - 'button "b8: Empty" [disabled] [ref=e66]'
            - 'button "c8: Empty" [disabled] [ref=e67]'
            - 'button "d8: Empty" [disabled] [ref=e68]'
            - 'button "e8: Empty, legal move" [ref=e69] [cursor=pointer]':
              - generic: ·
            - 'button "f8: Empty" [disabled] [ref=e70]'
            - 'button "g8: Empty" [disabled] [ref=e71]'
            - 'button "h8: Empty" [disabled] [ref=e72]'
            - 'button "i8: Empty" [disabled] [ref=e73]'
            - generic [ref=e74]: "7"
            - 'button "a7: Empty" [disabled] [ref=e75]'
            - 'button "b7: Empty" [disabled] [ref=e76]'
            - 'button "c7: Empty" [disabled] [ref=e77]'
            - 'button "d7: Empty" [disabled] [ref=e78]'
            - 'button "e7: Empty" [disabled] [ref=e79]'
            - 'button "f7: Empty" [disabled] [ref=e80]'
            - 'button "g7: Empty" [disabled] [ref=e81]'
            - 'button "h7: Empty" [disabled] [ref=e82]'
            - 'button "i7: Empty" [disabled] [ref=e83]'
            - generic [ref=e84]: "6"
            - 'button "a6: Empty" [disabled] [ref=e85]'
            - 'button "b6: Empty" [disabled] [ref=e86]'
            - 'button "c6: Empty" [disabled] [ref=e87]'
            - 'button "d6: Empty" [disabled] [ref=e88]'
            - 'button "e6: Empty" [disabled] [ref=e89]'
            - 'button "f6: Empty" [disabled] [ref=e90]'
            - 'button "g6: Empty" [disabled] [ref=e91]'
            - 'button "h6: Empty" [disabled] [ref=e92]'
            - 'button "i6: Empty" [disabled] [ref=e93]'
            - generic [ref=e94]: "5"
            - 'button "a5: Empty" [disabled] [ref=e95]'
            - 'button "b5: Empty" [disabled] [ref=e96]'
            - 'button "c5: Empty" [disabled] [ref=e97]'
            - 'button "d5: Empty" [disabled] [ref=e98]'
            - 'button "e5: Empty" [disabled] [ref=e99]'
            - 'button "f5: Empty" [disabled] [ref=e100]'
            - 'button "g5: Empty" [disabled] [ref=e101]'
            - 'button "h5: Empty" [disabled] [ref=e102]'
            - 'button "i5: Empty" [disabled] [ref=e103]'
            - generic [ref=e104]: "4"
            - 'button "a4: Empty" [disabled] [ref=e105]'
            - 'button "b4: Empty" [disabled] [ref=e106]'
            - 'button "c4: Empty" [disabled] [ref=e107]'
            - 'button "d4: Empty" [disabled] [ref=e108]'
            - 'button "e4: Empty" [disabled] [ref=e109]'
            - 'button "f4: Empty" [disabled] [ref=e110]'
            - 'button "g4: Empty" [disabled] [ref=e111]'
            - 'button "h4: Empty" [disabled] [ref=e112]'
            - 'button "i4: Empty" [disabled] [ref=e113]'
            - generic [ref=e114]: "3"
            - 'button "a3: Empty" [disabled] [ref=e115]'
            - 'button "b3: Empty" [disabled] [ref=e116]'
            - 'button "c3: Empty" [disabled] [ref=e117]'
            - 'button "d3: Empty" [disabled] [ref=e118]'
            - 'button "e3: Empty" [disabled] [active] [ref=e119]'
            - 'button "f3: Empty" [disabled] [ref=e120]'
            - 'button "g3: Empty" [disabled] [ref=e121]'
            - 'button "h3: Empty" [disabled] [ref=e122]'
            - 'button "i3: Empty" [disabled] [ref=e123]'
            - generic [ref=e124]: "2"
            - 'button "a2: Empty" [disabled] [ref=e125]'
            - 'button "b2: Empty" [disabled] [ref=e126]'
            - 'button "c2: Empty" [disabled] [ref=e127]'
            - 'button "d2: Empty" [disabled] [ref=e128]'
            - 'button "e2: South red circle" [disabled] [ref=e129]':
              - generic: ●
            - 'button "f2: Empty" [disabled] [ref=e130]'
            - 'button "g2: Empty" [disabled] [ref=e131]'
            - 'button "h2: Empty" [disabled] [ref=e132]'
            - 'button "i2: Empty" [disabled] [ref=e133]'
            - generic [ref=e134]: "1"
            - 'button "a1: Empty" [disabled] [ref=e135]'
            - 'button "b1: Empty" [disabled] [ref=e136]'
            - 'button "c1: Empty" [disabled] [ref=e137]'
            - 'button "d1: Empty" [disabled] [ref=e138]'
            - 'button "e1: Empty" [disabled] [ref=e139]'
            - 'button "f1: Empty" [disabled] [ref=e140]'
            - 'button "g1: Empty" [disabled] [ref=e141]'
            - 'button "h1: Empty" [disabled] [ref=e142]'
            - 'button "i1: Empty" [disabled] [ref=e143]'
          - status [ref=e144]: Choose a marked square to move your pawn.
        - status [ref=e146]:
          - generic [ref=e147]:
            - generic [ref=e148]: "South red circle: avery. North gold diamond: jordan_plays."
            - text: North gold diamond to move, heading for row 1.
        - generic [ref=e151]:
          - generic [ref=e156]:
            - img "South red circle" [ref=e157]:
              - generic [ref=e158]: ●
            - generic [ref=e159]: avery
            - generic [ref=e160]: Your move
          - generic [ref=e161]:
            - generic [ref=e162]: Walls
            - generic [ref=e163]: "10"
      - region "Game record" [ref=e166]:
        - generic [ref=e167]:
          - heading "Game record" [level=2] [ref=e169]
          - paragraph [ref=e170]: North gold diamond to move, heading for row 1.
        - generic [ref=e172]:
          - group "Game actions" [ref=e173]:
            - button "Move pawn" [pressed] [ref=e174] [cursor=pointer]:
              - paragraph [ref=e177]: Move pawn
            - button "Horizontal wall" [ref=e178] [cursor=pointer]:
              - paragraph [ref=e181]: Horizontal wall
            - button "Vertical wall" [ref=e182] [cursor=pointer]:
              - paragraph [ref=e185]: Vertical wall
            - button "Offer draw" [ref=e186] [cursor=pointer]:
              - paragraph [ref=e189]: Offer draw
            - button "Resign game" [ref=e190] [cursor=pointer]:
              - paragraph [ref=e193]:
                - text: Resign
                - generic [ref=e194]: game
          - button "History and stats" [ref=e195] [cursor=pointer]:
            - paragraph [ref=e198]: History and stats
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