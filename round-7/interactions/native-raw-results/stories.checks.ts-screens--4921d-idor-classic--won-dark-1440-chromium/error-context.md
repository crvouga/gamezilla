# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--won dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  198636 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/won-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/won-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 198636 pixels (ratio 0.17 of all image pixels) are different.
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
  - 198636 pixels (ratio 0.17 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "You win" [level=2] [ref=e28]
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
            - generic [ref=e51]:
              - img "North gold diamond" [ref=e52]:
                - generic [ref=e53]: ◆
              - generic "jordan_plays" [ref=e56]
            - generic [ref=e57]:
              - generic [ref=e58]: Walls
              - generic [ref=e59]: "10"
          - generic [ref=e61]:
            - generic [ref=e62]:
              - button "Move pawn" [disabled] [pressed] [ref=e63]:
                - paragraph [ref=e66]: Move
              - button "Horizontal wall" [disabled] [ref=e67]:
                - paragraph [ref=e70]: Horizontal wall
              - button "Vertical wall" [disabled] [ref=e71]:
                - paragraph [ref=e74]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e75]:
              - generic [ref=e77]: a
              - generic [ref=e78]: b
              - generic [ref=e79]: c
              - generic [ref=e80]: d
              - generic [ref=e81]: e
              - generic [ref=e82]: f
              - generic [ref=e83]: g
              - generic [ref=e84]: h
              - generic [ref=e85]: i
              - generic [ref=e86]: "9"
              - 'button "a9: Empty" [disabled] [ref=e87]'
              - 'button "b9: Empty" [disabled] [ref=e88]'
              - 'button "c9: Empty" [disabled] [ref=e89]'
              - 'button "d9: Empty" [disabled] [ref=e90]'
              - 'button "e9: South red circle" [disabled] [ref=e91]':
                - generic: ●
              - 'button "f9: Empty" [disabled] [ref=e92]'
              - 'button "g9: Empty" [disabled] [ref=e93]'
              - 'button "h9: Empty" [disabled] [ref=e94]'
              - 'button "i9: Empty" [disabled] [ref=e95]'
              - generic [ref=e96]: "8"
              - 'button "a8: Empty" [disabled] [ref=e97]'
              - 'button "b8: Empty" [disabled] [ref=e98]'
              - 'button "c8: Empty" [disabled] [ref=e99]'
              - 'button "d8: Empty" [disabled] [ref=e100]'
              - 'button "e8: Empty" [disabled] [ref=e101]'
              - 'button "f8: Empty" [disabled] [ref=e102]'
              - 'button "g8: Empty" [disabled] [ref=e103]'
              - 'button "h8: Empty" [disabled] [ref=e104]'
              - 'button "i8: Empty" [disabled] [ref=e105]'
              - generic [ref=e106]: "7"
              - 'button "a7: Empty" [disabled] [ref=e107]'
              - 'button "b7: Empty" [disabled] [ref=e108]'
              - 'button "c7: Empty" [disabled] [ref=e109]'
              - 'button "d7: Empty" [disabled] [ref=e110]'
              - 'button "e7: Empty" [disabled] [ref=e111]'
              - 'button "f7: Empty" [disabled] [ref=e112]'
              - 'button "g7: Empty" [disabled] [ref=e113]'
              - 'button "h7: Empty" [disabled] [ref=e114]'
              - 'button "i7: Empty" [disabled] [ref=e115]'
              - generic [ref=e116]: "6"
              - 'button "a6: North gold diamond" [disabled] [ref=e117]':
                - generic: ◆
              - 'button "b6: Empty" [disabled] [ref=e118]'
              - 'button "c6: Empty" [disabled] [ref=e119]'
              - 'button "d6: Empty" [disabled] [ref=e120]'
              - 'button "e6: Empty" [disabled] [ref=e121]'
              - 'button "f6: Empty" [disabled] [ref=e122]'
              - 'button "g6: Empty" [disabled] [ref=e123]'
              - 'button "h6: Empty" [disabled] [ref=e124]'
              - 'button "i6: Empty" [disabled] [ref=e125]'
              - generic [ref=e126]: "5"
              - 'button "a5: Empty" [disabled] [ref=e127]'
              - 'button "b5: Empty" [disabled] [ref=e128]'
              - 'button "c5: Empty" [disabled] [ref=e129]'
              - 'button "d5: Empty" [disabled] [ref=e130]'
              - 'button "e5: Empty" [disabled] [ref=e131]'
              - 'button "f5: Empty" [disabled] [ref=e132]'
              - 'button "g5: Empty" [disabled] [ref=e133]'
              - 'button "h5: Empty" [disabled] [ref=e134]'
              - 'button "i5: Empty" [disabled] [ref=e135]'
              - generic [ref=e136]: "4"
              - 'button "a4: Empty" [disabled] [ref=e137]'
              - 'button "b4: Empty" [disabled] [ref=e138]'
              - 'button "c4: Empty" [disabled] [ref=e139]'
              - 'button "d4: Empty" [disabled] [ref=e140]'
              - 'button "e4: Empty" [disabled] [ref=e141]'
              - 'button "f4: Empty" [disabled] [ref=e142]'
              - 'button "g4: Empty" [disabled] [ref=e143]'
              - 'button "h4: Empty" [disabled] [ref=e144]'
              - 'button "i4: Empty" [disabled] [ref=e145]'
              - generic [ref=e146]: "3"
              - 'button "a3: Empty" [disabled] [ref=e147]'
              - 'button "b3: Empty" [disabled] [ref=e148]'
              - 'button "c3: Empty" [disabled] [ref=e149]'
              - 'button "d3: Empty" [disabled] [ref=e150]'
              - 'button "e3: Empty" [disabled] [ref=e151]'
              - 'button "f3: Empty" [disabled] [ref=e152]'
              - 'button "g3: Empty" [disabled] [ref=e153]'
              - 'button "h3: Empty" [disabled] [ref=e154]'
              - 'button "i3: Empty" [disabled] [ref=e155]'
              - generic [ref=e156]: "2"
              - 'button "a2: Empty" [disabled] [ref=e157]'
              - 'button "b2: Empty" [disabled] [ref=e158]'
              - 'button "c2: Empty" [disabled] [ref=e159]'
              - 'button "d2: Empty" [disabled] [ref=e160]'
              - 'button "e2: Empty" [disabled] [ref=e161]'
              - 'button "f2: Empty" [disabled] [ref=e162]'
              - 'button "g2: Empty" [disabled] [ref=e163]'
              - 'button "h2: Empty" [disabled] [ref=e164]'
              - 'button "i2: Empty" [disabled] [ref=e165]'
              - generic [ref=e166]: "1"
              - 'button "a1: Empty, goal edge" [disabled] [ref=e167]'
              - 'button "b1: Empty, goal edge" [disabled] [ref=e168]'
              - 'button "c1: Empty, goal edge" [disabled] [ref=e169]'
              - 'button "d1: Empty, goal edge" [disabled] [ref=e170]'
              - 'button "e1: Empty, goal edge" [disabled] [ref=e171]'
              - 'button "f1: Empty, goal edge" [disabled] [ref=e172]'
              - 'button "g1: Empty, goal edge" [disabled] [ref=e173]'
              - 'button "h1: Empty, goal edge" [disabled] [ref=e174]'
              - 'button "i1: Empty, goal edge" [disabled] [ref=e175]'
            - status [ref=e176]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e178]:
            - generic [ref=e179]:
              - generic [ref=e180]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: The opposite home row was reached. Game won.
          - generic [ref=e183]:
            - generic [ref=e188]:
              - img "South red circle" [ref=e189]:
                - generic [ref=e190]: ●
              - generic "avery" [ref=e193]
            - generic [ref=e194]:
              - generic [ref=e195]: Walls
              - generic [ref=e196]: "10"
        - list "Standings" [ref=e199]:
          - listitem [ref=e200]:
            - generic [ref=e201]:
              - generic [ref=e202]: 1st
              - generic [ref=e205]: avery
          - listitem [ref=e206]:
            - generic [ref=e207]:
              - generic [ref=e208]: 2nd
              - generic [ref=e211]: jordan_plays
        - region "Game record" [ref=e214]:
          - generic [ref=e215]:
            - heading "Game record" [level=2] [ref=e217]
            - paragraph [ref=e218]: The opposite home row was reached. Game won.
          - button "History and stats" [ref=e221] [cursor=pointer]:
            - paragraph [ref=e224]: History and stats
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