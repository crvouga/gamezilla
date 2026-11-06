# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--won light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  23050 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/won-light.png

Call log:
  - Expect "toHaveScreenshot(libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/won-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 23050 pixels (ratio 0.08 of all image pixels) are different.
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
  - 23050 pixels (ratio 0.08 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Classic Quoridor" [level=1] [ref=e16]
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
          - generic [ref=e40]:
            - generic [ref=e45]:
              - img "North gold diamond" [ref=e46]:
                - generic [ref=e47]: ◆
              - generic [ref=e48]: jordan_plays
            - generic [ref=e49]:
              - generic [ref=e50]: Walls
              - generic [ref=e51]: "10"
          - generic [ref=e53]:
            - generic [ref=e54]:
              - button "Move pawn" [disabled] [pressed] [ref=e55]:
                - paragraph [ref=e58]: Move pawn
              - button "Horizontal wall" [disabled] [ref=e59]:
                - paragraph [ref=e62]: Wall across
              - button "Vertical wall" [disabled] [ref=e63]:
                - paragraph [ref=e66]: Wall down
            - group "Quoridor board, nine columns and nine rows" [ref=e67]:
              - generic [ref=e69]: a
              - generic [ref=e70]: b
              - generic [ref=e71]: c
              - generic [ref=e72]: d
              - generic [ref=e73]: e
              - generic [ref=e74]: f
              - generic [ref=e75]: g
              - generic [ref=e76]: h
              - generic [ref=e77]: i
              - generic [ref=e78]: "9"
              - 'button "a9: Empty" [disabled] [ref=e79]'
              - 'button "b9: Empty" [disabled] [ref=e80]'
              - 'button "c9: Empty" [disabled] [ref=e81]'
              - 'button "d9: Empty" [disabled] [ref=e82]'
              - 'button "e9: South red circle" [disabled] [ref=e83]':
                - generic: ●
              - 'button "f9: Empty" [disabled] [ref=e84]'
              - 'button "g9: Empty" [disabled] [ref=e85]'
              - 'button "h9: Empty" [disabled] [ref=e86]'
              - 'button "i9: Empty" [disabled] [ref=e87]'
              - generic [ref=e88]: "8"
              - 'button "a8: Empty" [disabled] [ref=e89]'
              - 'button "b8: Empty" [disabled] [ref=e90]'
              - 'button "c8: Empty" [disabled] [ref=e91]'
              - 'button "d8: Empty" [disabled] [ref=e92]'
              - 'button "e8: Empty" [disabled] [ref=e93]'
              - 'button "f8: Empty" [disabled] [ref=e94]'
              - 'button "g8: Empty" [disabled] [ref=e95]'
              - 'button "h8: Empty" [disabled] [ref=e96]'
              - 'button "i8: Empty" [disabled] [ref=e97]'
              - generic [ref=e98]: "7"
              - 'button "a7: Empty" [disabled] [ref=e99]'
              - 'button "b7: Empty" [disabled] [ref=e100]'
              - 'button "c7: Empty" [disabled] [ref=e101]'
              - 'button "d7: Empty" [disabled] [ref=e102]'
              - 'button "e7: Empty" [disabled] [ref=e103]'
              - 'button "f7: Empty" [disabled] [ref=e104]'
              - 'button "g7: Empty" [disabled] [ref=e105]'
              - 'button "h7: Empty" [disabled] [ref=e106]'
              - 'button "i7: Empty" [disabled] [ref=e107]'
              - generic [ref=e108]: "6"
              - 'button "a6: North gold diamond" [disabled] [ref=e109]':
                - generic: ◆
              - 'button "b6: Empty" [disabled] [ref=e110]'
              - 'button "c6: Empty" [disabled] [ref=e111]'
              - 'button "d6: Empty" [disabled] [ref=e112]'
              - 'button "e6: Empty" [disabled] [ref=e113]'
              - 'button "f6: Empty" [disabled] [ref=e114]'
              - 'button "g6: Empty" [disabled] [ref=e115]'
              - 'button "h6: Empty" [disabled] [ref=e116]'
              - 'button "i6: Empty" [disabled] [ref=e117]'
              - generic [ref=e118]: "5"
              - 'button "a5: Empty" [disabled] [ref=e119]'
              - 'button "b5: Empty" [disabled] [ref=e120]'
              - 'button "c5: Empty" [disabled] [ref=e121]'
              - 'button "d5: Empty" [disabled] [ref=e122]'
              - 'button "e5: Empty" [disabled] [ref=e123]'
              - 'button "f5: Empty" [disabled] [ref=e124]'
              - 'button "g5: Empty" [disabled] [ref=e125]'
              - 'button "h5: Empty" [disabled] [ref=e126]'
              - 'button "i5: Empty" [disabled] [ref=e127]'
              - generic [ref=e128]: "4"
              - 'button "a4: Empty" [disabled] [ref=e129]'
              - 'button "b4: Empty" [disabled] [ref=e130]'
              - 'button "c4: Empty" [disabled] [ref=e131]'
              - 'button "d4: Empty" [disabled] [ref=e132]'
              - 'button "e4: Empty" [disabled] [ref=e133]'
              - 'button "f4: Empty" [disabled] [ref=e134]'
              - 'button "g4: Empty" [disabled] [ref=e135]'
              - 'button "h4: Empty" [disabled] [ref=e136]'
              - 'button "i4: Empty" [disabled] [ref=e137]'
              - generic [ref=e138]: "3"
              - 'button "a3: Empty" [disabled] [ref=e139]'
              - 'button "b3: Empty" [disabled] [ref=e140]'
              - 'button "c3: Empty" [disabled] [ref=e141]'
              - 'button "d3: Empty" [disabled] [ref=e142]'
              - 'button "e3: Empty" [disabled] [ref=e143]'
              - 'button "f3: Empty" [disabled] [ref=e144]'
              - 'button "g3: Empty" [disabled] [ref=e145]'
              - 'button "h3: Empty" [disabled] [ref=e146]'
              - 'button "i3: Empty" [disabled] [ref=e147]'
              - generic [ref=e148]: "2"
              - 'button "a2: Empty" [disabled] [ref=e149]'
              - 'button "b2: Empty" [disabled] [ref=e150]'
              - 'button "c2: Empty" [disabled] [ref=e151]'
              - 'button "d2: Empty" [disabled] [ref=e152]'
              - 'button "e2: Empty" [disabled] [ref=e153]'
              - 'button "f2: Empty" [disabled] [ref=e154]'
              - 'button "g2: Empty" [disabled] [ref=e155]'
              - 'button "h2: Empty" [disabled] [ref=e156]'
              - 'button "i2: Empty" [disabled] [ref=e157]'
              - generic [ref=e158]: "1"
              - 'button "a1: Empty" [disabled] [ref=e159]'
              - 'button "b1: Empty" [disabled] [ref=e160]'
              - 'button "c1: Empty" [disabled] [ref=e161]'
              - 'button "d1: Empty" [disabled] [ref=e162]'
              - 'button "e1: Empty" [disabled] [ref=e163]'
              - 'button "f1: Empty" [disabled] [ref=e164]'
              - 'button "g1: Empty" [disabled] [ref=e165]'
              - 'button "h1: Empty" [disabled] [ref=e166]'
              - 'button "i1: Empty" [disabled] [ref=e167]'
            - status [ref=e168]: Game finished. Use the game controls to review earlier moves.
          - status [ref=e172]:
            - generic [ref=e173]:
              - generic [ref=e174]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: The opposite home row was reached. Game won.
          - generic [ref=e177]:
            - generic [ref=e182]:
              - img "South red circle" [ref=e183]:
                - generic [ref=e184]: ●
              - generic [ref=e185]: avery
            - generic [ref=e186]:
              - generic [ref=e187]: Walls
              - generic [ref=e188]: "10"
        - generic [ref=e189]:
          - generic [ref=e190]:
            - heading "You win" [level=2] [ref=e192]
            - list "Standings" [ref=e193]:
              - listitem [ref=e194]:
                - generic [ref=e195]:
                  - generic [ref=e196]: 1st
                  - generic [ref=e199]: avery
              - listitem [ref=e200]:
                - generic [ref=e201]:
                  - generic [ref=e202]: 2nd
                  - generic [ref=e205]: jordan_plays
          - generic [ref=e207]:
            - group "What next" [ref=e208]:
              - button "Rematch" [ref=e209] [cursor=pointer]:
                - paragraph [ref=e212]: Rematch
              - button "Change game" [ref=e213] [cursor=pointer]:
                - paragraph [ref=e216]: Change game
              - button "Review" [ref=e217] [cursor=pointer]:
                - paragraph [ref=e220]: Review
            - button "History and stats" [ref=e221] [cursor=pointer]:
              - generic [ref=e223]:
                - paragraph [ref=e224]: History and stats
                - img [ref=e227]
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