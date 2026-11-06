# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-hill--reach-the-hill light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1580 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-hill/reach-the-hill-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1580 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1580 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e27]: Live
        - list "Moves played" [ref=e32]:
          - listitem [ref=e33]:
            - generic [ref=e34]: Move 4
            - generic [ref=e35]:
              - generic [ref=e37]: ●
              - 'button "Move 13, South red circle: e5" [ref=e38] [cursor=pointer]': e5
        - button "All moves" [ref=e39] [cursor=pointer]:
          - img [ref=e43]
      - generic [ref=e45]:
        - generic [ref=e47]:
          - list "Players" [ref=e48]:
            - listitem [ref=e49]:
              - generic [ref=e54]:
                - generic [ref=e55]: jordan_plays
                - generic [ref=e56]:
                  - generic [ref=e58]: ◆
                  - generic [ref=e59]: Walls 5
                  - generic [ref=e61]: You
            - listitem [ref=e62]:
              - generic [ref=e66]:
                - generic [ref=e67]: avery
                - generic [ref=e68]:
                  - generic [ref=e70]: ●
                  - generic [ref=e71]: Walls 5
            - listitem [ref=e72]:
              - generic [ref=e76]:
                - generic [ref=e77]: morgan
                - generic [ref=e78]:
                  - generic [ref=e80]: ▲
                  - generic [ref=e81]: Walls 5
            - listitem [ref=e82]:
              - generic [ref=e86]:
                - generic [ref=e87]: robin_42
                - generic [ref=e88]:
                  - generic [ref=e90]: ■
                  - generic [ref=e91]: Walls 5
          - generic [ref=e93]:
            - group "Quoridor board, nine columns and nine rows" [ref=e94]:
              - generic [ref=e96]: a
              - generic [ref=e97]: b
              - generic [ref=e98]: c
              - generic [ref=e99]: d
              - generic [ref=e100]: e
              - generic [ref=e101]: f
              - generic [ref=e102]: g
              - generic [ref=e103]: h
              - generic [ref=e104]: i
              - generic [ref=e105]: "9"
              - 'button "a9: Empty" [disabled] [ref=e106]'
              - 'button "b9: Empty" [disabled] [ref=e107]'
              - 'button "c9: Empty" [disabled] [ref=e108]'
              - 'button "d9: Empty" [disabled] [ref=e109]'
              - 'button "e9: Empty" [disabled] [ref=e110]'
              - 'button "f9: Empty" [disabled] [ref=e111]'
              - 'button "g9: Empty" [disabled] [ref=e112]'
              - 'button "h9: Empty" [disabled] [ref=e113]'
              - 'button "i9: Empty" [disabled] [ref=e114]'
              - generic [ref=e115]: "8"
              - 'button "a8: Empty" [disabled] [ref=e116]'
              - 'button "b8: Empty" [disabled] [ref=e117]'
              - 'button "c8: North green triangle" [disabled] [ref=e118]':
                - generic: ▲
              - 'button "d8: Empty" [disabled] [ref=e119]'
              - 'button "e8: Empty" [disabled] [ref=e120]'
              - 'button "f8: Empty" [disabled] [ref=e121]'
              - 'button "g8: Empty" [disabled] [ref=e122]'
              - 'button "h8: Empty" [disabled] [ref=e123]'
              - 'button "i8: East black square" [disabled] [ref=e124]':
                - generic: ■
              - generic [ref=e125]: "7"
              - 'button "a7: Empty" [disabled] [ref=e126]'
              - 'button "b7: Empty" [disabled] [ref=e127]'
              - 'button "c7: Empty" [disabled] [ref=e128]'
              - 'button "d7: Empty" [disabled] [ref=e129]'
              - 'button "e7: Empty" [disabled] [ref=e130]'
              - 'button "f7: Empty" [disabled] [ref=e131]'
              - 'button "g7: Empty" [disabled] [ref=e132]'
              - 'button "h7: Empty" [disabled] [ref=e133]'
              - 'button "i7: Empty" [disabled] [ref=e134]'
              - generic [ref=e135]: "6"
              - 'button "a6: Empty" [disabled] [ref=e136]'
              - 'button "b6: Empty" [disabled] [ref=e137]'
              - 'button "c6: Empty" [disabled] [ref=e138]'
              - 'button "d6: Empty" [disabled] [ref=e139]'
              - 'button "e6: Empty" [disabled] [ref=e140]'
              - 'button "f6: Empty" [disabled] [ref=e141]'
              - 'button "g6: Empty" [disabled] [ref=e142]'
              - 'button "h6: Empty" [disabled] [ref=e143]'
              - 'button "i6: Empty" [disabled] [ref=e144]'
              - generic [ref=e145]: "5"
              - 'button "a5: Empty" [disabled] [ref=e146]'
              - 'button "b5: Empty" [disabled] [ref=e147]'
              - 'button "c5: Empty" [disabled] [ref=e148]'
              - 'button "d5: Empty" [disabled] [ref=e149]'
              - 'button "e5: South red circle" [disabled] [ref=e150]':
                - generic: ●
              - 'button "f5: Empty" [disabled] [ref=e151]'
              - 'button "g5: Empty" [disabled] [ref=e152]'
              - 'button "h5: Empty" [disabled] [ref=e153]'
              - 'button "i5: Empty" [disabled] [ref=e154]'
              - generic [ref=e155]: "4"
              - 'button "a4: Empty" [disabled] [ref=e156]'
              - 'button "b4: Empty" [disabled] [ref=e157]'
              - 'button "c4: Empty" [disabled] [ref=e158]'
              - 'button "d4: Empty" [disabled] [ref=e159]'
              - 'button "e4: Empty" [disabled] [ref=e160]'
              - 'button "f4: Empty" [disabled] [ref=e161]'
              - 'button "g4: Empty" [disabled] [ref=e162]'
              - 'button "h4: Empty" [disabled] [ref=e163]'
              - 'button "i4: Empty" [disabled] [ref=e164]'
              - generic [ref=e165]: "3"
              - 'button "a3: Empty" [disabled] [ref=e166]'
              - 'button "b3: Empty" [disabled] [ref=e167]'
              - 'button "c3: Empty" [disabled] [ref=e168]'
              - 'button "d3: Empty" [disabled] [ref=e169]'
              - 'button "e3: Empty" [disabled] [ref=e170]'
              - 'button "f3: Empty" [disabled] [ref=e171]'
              - 'button "g3: Empty" [disabled] [ref=e172]'
              - 'button "h3: Empty" [disabled] [ref=e173]'
              - 'button "i3: Empty" [disabled] [ref=e174]'
              - generic [ref=e175]: "2"
              - 'button "a2: West gold diamond" [disabled] [ref=e176]':
                - generic: ◆
              - 'button "b2: Empty" [disabled] [ref=e177]'
              - 'button "c2: Empty" [disabled] [ref=e178]'
              - 'button "d2: Empty" [disabled] [ref=e179]'
              - 'button "e2: Empty" [disabled] [ref=e180]'
              - 'button "f2: Empty" [disabled] [ref=e181]'
              - 'button "g2: Empty" [disabled] [ref=e182]'
              - 'button "h2: Empty" [disabled] [ref=e183]'
              - 'button "i2: Empty" [disabled] [ref=e184]'
              - generic [ref=e185]: "1"
              - 'button "a1: Empty" [disabled] [ref=e186]'
              - 'button "b1: Empty" [disabled] [ref=e187]'
              - 'button "c1: Empty" [disabled] [ref=e188]'
              - 'button "d1: Empty" [disabled] [ref=e189]'
              - 'button "e1: Empty" [disabled] [ref=e190]'
              - 'button "f1: Empty" [disabled] [ref=e191]'
              - 'button "g1: Empty" [disabled] [ref=e192]'
              - 'button "h1: Empty" [disabled] [ref=e193]'
              - 'button "i1: Empty" [disabled] [ref=e194]'
            - status [ref=e195]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e199]:
            - generic [ref=e200]:
              - generic [ref=e201]: "South red circle: avery. West gold diamond: jordan_plays. North green triangle: morgan. East black square: robin_42."
              - text: The central hill was reached. Game won.
        - generic [ref=e202]:
          - generic [ref=e203]:
            - heading "avery wins" [level=2] [ref=e205]
            - list "Standings" [ref=e206]:
              - listitem [ref=e207]:
                - generic [ref=e208]:
                  - generic [ref=e209]: 1st
                  - generic [ref=e212]: avery
              - listitem [ref=e213]:
                - generic [ref=e214]:
                  - generic [ref=e215]: 2nd
                  - generic [ref=e218]: jordan_plays
              - listitem [ref=e219]:
                - generic [ref=e220]:
                  - generic [ref=e221]: 2nd
                  - generic [ref=e224]: morgan
              - listitem [ref=e225]:
                - generic [ref=e226]:
                  - generic [ref=e227]: 2nd
                  - generic [ref=e230]: robin_42
          - generic [ref=e232]:
            - group "What next" [ref=e233]:
              - button "Rematch" [ref=e234] [cursor=pointer]:
                - paragraph [ref=e237]: Rematch
              - button "Change game" [ref=e238] [cursor=pointer]:
                - paragraph [ref=e241]: Change game
              - button "Review" [ref=e242] [cursor=pointer]:
                - paragraph [ref=e245]: Review
            - button "History and stats" [ref=e246] [cursor=pointer]:
              - generic [ref=e248]:
                - paragraph [ref=e249]: History and stats
                - img [ref=e252]
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