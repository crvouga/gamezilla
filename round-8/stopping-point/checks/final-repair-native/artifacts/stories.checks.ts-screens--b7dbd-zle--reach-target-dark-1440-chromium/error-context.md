# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-puzzle--reach-target dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  151110 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-puzzle/reach-target-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 151110 pixels (ratio 0.13 of all image pixels) are different.
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
  - 151110 pixels (ratio 0.13 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e9]:
    - generic [ref=e11]:
      - img "Unnamed App" [ref=e13]:
        - img [ref=e14]
        - generic [ref=e15]: Unnamed App
      - navigation "Navigation" [ref=e16]:
        - button "Spaces" [ref=e17] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e21]: Spaces
        - button "Search" [ref=e22] [cursor=pointer]:
          - img [ref=e24]
          - generic [ref=e27]: Search
        - button "Notifications" [ref=e28] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e33]: Notifications
        - button "Profile" [ref=e34] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e39]: Profile
      - button "@avery, account menu" [ref=e43] [cursor=pointer]:
        - generic [ref=e46]: "@avery"
    - generic [ref=e50]:
      - generic [ref=e52]:
        - navigation "Breadcrumb" [ref=e55]:
          - list [ref=e56]:
            - listitem [ref=e57]:
              - generic [ref=e58]:
                - generic [ref=e59]: F
                - generic [ref=e60]: Friday game night
        - generic [ref=e63]:
          - button "People in this space" [ref=e65] [cursor=pointer]:
            - img [ref=e69]
          - button "Minimize space" [ref=e75] [cursor=pointer]:
            - img [ref=e79]
          - button "More" [ref=e83] [cursor=pointer]:
            - img [ref=e86]
      - generic [ref=e91]:
        - paragraph [ref=e92]: Score at least 6 points in one move.
        - status [ref=e93]: Your last move scored 8 of 6.
        - generic [ref=e94]:
          - img [ref=e97]
          - generic [ref=e100]:
            - status [ref=e101]: Target reached. Puzzle solved!
            - button "Puzzle library" [active] [ref=e102] [cursor=pointer]:
              - paragraph [ref=e105]: Puzzle library
        - paragraph [ref=e106]: "2L/3L: double/triple letter. 2W/3W: double/triple word."
        - generic [ref=e107]:
          - generic [ref=e108]:
            - button "Fit board" [pressed] [ref=e109] [cursor=pointer]:
              - paragraph [ref=e112]: Fit board
            - button "Enlarge board" [ref=e113] [cursor=pointer]:
              - paragraph [ref=e116]: Enlarge board
          - region "Scrollable word board" [ref=e118]:
            - group "Puzzle board, fifteen columns and fifteen rows" [ref=e119]:
              - generic [ref=e121]: a
              - generic [ref=e122]: b
              - generic [ref=e123]: c
              - generic [ref=e124]: d
              - generic [ref=e125]: e
              - generic [ref=e126]: f
              - generic [ref=e127]: g
              - generic [ref=e128]: h
              - generic [ref=e129]: i
              - generic [ref=e130]: j
              - generic [ref=e131]: k
              - generic [ref=e132]: l
              - generic [ref=e133]: m
              - generic [ref=e134]: "n"
              - generic [ref=e135]: o
              - generic [ref=e136]: "1"
              - button "2L, a1, double letter, empty" [disabled] [ref=e137]:
                - generic [ref=e138]: 2L
              - button "b1, empty" [disabled] [ref=e139]
              - button "c1, empty" [disabled] [ref=e140]
              - button "d1, empty" [disabled] [ref=e141]
              - button "3W, e1, triple word, empty" [disabled] [ref=e142]:
                - generic [ref=e143]: 3W
              - button "f1, empty" [disabled] [ref=e144]
              - button "g1, empty" [disabled] [ref=e145]
              - button "2L, h1, double letter, empty" [disabled] [ref=e146]:
                - generic [ref=e147]: 2L
              - button "i1, empty" [disabled] [ref=e148]
              - button "j1, empty" [disabled] [ref=e149]
              - button "3W, k1, triple word, empty" [disabled] [ref=e150]:
                - generic [ref=e151]: 3W
              - button "l1, empty" [disabled] [ref=e152]
              - button "m1, empty" [disabled] [ref=e153]
              - button "n1, empty" [disabled] [ref=e154]
              - button "2L, o1, double letter, empty" [disabled] [ref=e155]:
                - generic [ref=e156]: 2L
              - generic [ref=e157]: "2"
              - button "a2, empty" [disabled] [ref=e158]
              - button "b2, empty" [disabled] [ref=e159]
              - button "c2, empty" [disabled] [ref=e160]
              - button "2L, d2, double letter, empty" [disabled] [ref=e161]:
                - generic [ref=e162]: 2L
              - button "e2, empty" [disabled] [ref=e163]
              - button "f2, empty" [disabled] [ref=e164]
              - button "2W, g2, double word, empty" [disabled] [ref=e165]:
                - generic [ref=e166]: 2W
              - button "h2, empty" [disabled] [ref=e167]
              - button "2W, i2, double word, empty" [disabled] [ref=e168]:
                - generic [ref=e169]: 2W
              - button "j2, empty" [disabled] [ref=e170]
              - button "k2, empty" [disabled] [ref=e171]
              - button "2L, l2, double letter, empty" [disabled] [ref=e172]:
                - generic [ref=e173]: 2L
              - button "m2, empty" [disabled] [ref=e174]
              - button "n2, empty" [disabled] [ref=e175]
              - button "o2, empty" [disabled] [ref=e176]
              - generic [ref=e177]: "3"
              - button "a3, empty" [disabled] [ref=e178]
              - button "b3, empty" [disabled] [ref=e179]
              - button "c3, empty" [disabled] [ref=e180]
              - button "d3, empty" [disabled] [ref=e181]
              - button "3L, e3, triple letter, empty" [disabled] [ref=e182]:
                - generic [ref=e183]: 3L
              - button "f3, empty" [disabled] [ref=e184]
              - button "g3, empty" [disabled] [ref=e185]
              - button "h3, empty" [disabled] [ref=e186]
              - button "i3, empty" [disabled] [ref=e187]
              - button "j3, empty" [disabled] [ref=e188]
              - button "3L, k3, triple letter, empty" [disabled] [ref=e189]:
                - generic [ref=e190]: 3L
              - button "l3, empty" [disabled] [ref=e191]
              - button "m3, empty" [disabled] [ref=e192]
              - button "n3, empty" [disabled] [ref=e193]
              - button "o3, empty" [disabled] [ref=e194]
              - generic [ref=e195]: "4"
              - button "a4, empty" [disabled] [ref=e196]
              - button "2L, b4, double letter, empty" [disabled] [ref=e197]:
                - generic [ref=e198]: 2L
              - button "c4, empty" [disabled] [ref=e199]
              - button "2W, d4, double word, empty" [disabled] [ref=e200]:
                - generic [ref=e201]: 2W
              - button "e4, empty" [disabled] [ref=e202]
              - button "f4, empty" [disabled] [ref=e203]
              - button "g4, empty" [disabled] [ref=e204]
              - button "h4, empty" [disabled] [ref=e205]
              - button "i4, empty" [disabled] [ref=e206]
              - button "j4, empty" [disabled] [ref=e207]
              - button "k4, empty" [disabled] [ref=e208]
              - button "2W, l4, double word, empty" [disabled] [ref=e209]:
                - generic [ref=e210]: 2W
              - button "m4, empty" [disabled] [ref=e211]
              - button "2L, n4, double letter, empty" [disabled] [ref=e212]:
                - generic [ref=e213]: 2L
              - button "o4, empty" [disabled] [ref=e214]
              - generic [ref=e215]: "5"
              - button "3W, a5, triple word, empty" [disabled] [ref=e216]:
                - generic [ref=e217]: 3W
              - button "b5, empty" [disabled] [ref=e218]
              - button "3L, c5, triple letter, empty" [disabled] [ref=e219]:
                - generic [ref=e220]: 3L
              - button "d5, empty" [disabled] [ref=e221]
              - button "e5, empty" [disabled] [ref=e222]
              - button "f5, empty" [disabled] [ref=e223]
              - button "2L, g5, double letter, empty" [disabled] [ref=e224]:
                - generic [ref=e225]: 2L
              - button "h5, empty" [disabled] [ref=e226]
              - button "2L, i5, double letter, empty" [disabled] [ref=e227]:
                - generic [ref=e228]: 2L
              - button "j5, empty" [disabled] [ref=e229]
              - button "k5, empty" [disabled] [ref=e230]
              - button "l5, empty" [disabled] [ref=e231]
              - button "3L, m5, triple letter, empty" [disabled] [ref=e232]:
                - generic [ref=e233]: 3L
              - button "n5, empty" [disabled] [ref=e234]
              - button "3W, o5, triple word, empty" [disabled] [ref=e235]:
                - generic [ref=e236]: 3W
              - generic [ref=e237]: "6"
              - button "a6, empty" [disabled] [ref=e238]
              - button "b6, empty" [disabled] [ref=e239]
              - button "c6, empty" [disabled] [ref=e240]
              - button "d6, empty" [disabled] [ref=e241]
              - button "e6, empty" [disabled] [ref=e242]
              - button "f6, empty" [disabled] [ref=e243]
              - button "g6, empty" [disabled] [ref=e244]
              - button "3L, h6, triple letter, empty" [disabled] [ref=e245]:
                - generic [ref=e246]: 3L
              - button "i6, empty" [disabled] [ref=e247]
              - button "j6, empty" [disabled] [ref=e248]
              - button "k6, empty" [disabled] [ref=e249]
              - button "l6, empty" [disabled] [ref=e250]
              - button "m6, empty" [disabled] [ref=e251]
              - button "n6, empty" [disabled] [ref=e252]
              - button "o6, empty" [disabled] [ref=e253]
              - generic [ref=e254]: "7"
              - button "a7, empty" [disabled] [ref=e255]
              - button "2W, b7, double word, empty" [disabled] [ref=e256]:
                - generic [ref=e257]: 2W
              - button "c7, empty" [disabled] [ref=e258]
              - button "d7, empty" [disabled] [ref=e259]
              - button "2L, e7, double letter, empty" [disabled] [ref=e260]:
                - generic [ref=e261]: 2L
              - button "f7, empty" [disabled] [ref=e262]
              - button "2L, g7, double letter, empty" [disabled] [ref=e263]:
                - generic [ref=e264]: 2L
              - button "h7, empty" [disabled] [ref=e265]
              - button "2L, i7, double letter, empty" [disabled] [ref=e266]:
                - generic [ref=e267]: 2L
              - button "j7, empty" [disabled] [ref=e268]
              - button "2L, k7, double letter, empty" [disabled] [ref=e269]:
                - generic [ref=e270]: 2L
              - button "l7, empty" [disabled] [ref=e271]
              - button "m7, empty" [disabled] [ref=e272]
              - button "2W, n7, double word, empty" [disabled] [ref=e273]:
                - generic [ref=e274]: 2W
              - button "o7, empty" [disabled] [ref=e275]
              - generic [ref=e276]: "8"
              - button "2L, a8, double letter, empty" [disabled] [ref=e277]:
                - generic [ref=e278]: 2L
              - button "b8, empty" [disabled] [ref=e279]
              - button "c8, empty" [disabled] [ref=e280]
              - button "d8, empty" [disabled] [ref=e281]
              - button "e8, empty" [disabled] [ref=e282]
              - button "3L, f8, triple letter, empty" [disabled] [ref=e283]:
                - generic [ref=e284]: 3L
              - button "C 3, g8, committed" [disabled] [ref=e285]:
                - generic [ref=e286]: C
              - button "A 1, h8, committed" [disabled] [ref=e287]:
                - generic [ref=e288]: A
              - button "T 1, i8, committed" [disabled] [ref=e289]:
                - generic [ref=e290]: T
              - button "S 1, j8, committed" [disabled] [ref=e291]:
                - generic [ref=e292]: S
              - button "k8, empty" [disabled] [ref=e293]
              - button "l8, empty" [disabled] [ref=e294]
              - button "m8, empty" [disabled] [ref=e295]
              - button "n8, empty" [disabled] [ref=e296]
              - button "2L, o8, double letter, empty" [disabled] [ref=e297]:
                - generic [ref=e298]: 2L
              - generic [ref=e299]: "9"
              - button "a9, empty" [disabled] [ref=e300]
              - button "2W, b9, double word, empty" [disabled] [ref=e301]:
                - generic [ref=e302]: 2W
              - button "c9, empty" [disabled] [ref=e303]
              - button "d9, empty" [disabled] [ref=e304]
              - button "2L, e9, double letter, empty" [disabled] [ref=e305]:
                - generic [ref=e306]: 2L
              - button "f9, empty" [disabled] [ref=e307]
              - button "2L, g9, double letter, empty" [disabled] [ref=e308]:
                - generic [ref=e309]: 2L
              - button "h9, empty" [disabled] [ref=e310]
              - button "O 1, i9, committed" [disabled] [ref=e311]:
                - generic [ref=e312]: O
              - button "j9, empty" [disabled] [ref=e313]
              - button "2L, k9, double letter, empty" [disabled] [ref=e314]:
                - generic [ref=e315]: 2L
              - button "l9, empty" [disabled] [ref=e316]
              - button "m9, empty" [disabled] [ref=e317]
              - button "2W, n9, double word, empty" [disabled] [ref=e318]:
                - generic [ref=e319]: 2W
              - button "o9, empty" [disabled] [ref=e320]
              - generic [ref=e321]: "10"
              - button "a10, empty" [disabled] [ref=e322]
              - button "b10, empty" [disabled] [ref=e323]
              - button "c10, empty" [disabled] [ref=e324]
              - button "d10, empty" [disabled] [ref=e325]
              - button "e10, empty" [disabled] [ref=e326]
              - button "f10, empty" [disabled] [ref=e327]
              - button "g10, empty" [disabled] [ref=e328]
              - button "3L, h10, triple letter, empty" [disabled] [ref=e329]:
                - generic [ref=e330]: 3L
              - button "E 1, i10, committed" [disabled] [ref=e331]:
                - generic [ref=e332]: E
              - button "j10, empty" [disabled] [ref=e333]
              - button "k10, empty" [disabled] [ref=e334]
              - button "l10, empty" [disabled] [ref=e335]
              - button "m10, empty" [disabled] [ref=e336]
              - button "n10, empty" [disabled] [ref=e337]
              - button "o10, empty" [disabled] [ref=e338]
              - generic [ref=e339]: "11"
              - button "3W, a11, triple word, empty" [disabled] [ref=e340]:
                - generic [ref=e341]: 3W
              - button "b11, empty" [disabled] [ref=e342]
              - button "3L, c11, triple letter, empty" [disabled] [ref=e343]:
                - generic [ref=e344]: 3L
              - button "d11, empty" [disabled] [ref=e345]
              - button "e11, empty" [disabled] [ref=e346]
              - button "f11, empty" [disabled] [ref=e347]
              - button "2L, g11, double letter, empty" [disabled] [ref=e348]:
                - generic [ref=e349]: 2L
              - button "h11, empty" [disabled] [ref=e350]
              - button "2L, i11, double letter, empty" [disabled] [ref=e351]:
                - generic [ref=e352]: 2L
              - button "j11, empty" [disabled] [ref=e353]
              - button "k11, empty" [disabled] [ref=e354]
              - button "l11, empty" [disabled] [ref=e355]
              - button "3L, m11, triple letter, empty" [disabled] [ref=e356]:
                - generic [ref=e357]: 3L
              - button "n11, empty" [disabled] [ref=e358]
              - button "3W, o11, triple word, empty" [disabled] [ref=e359]:
                - generic [ref=e360]: 3W
              - generic [ref=e361]: "12"
              - button "a12, empty" [disabled] [ref=e362]
              - button "2L, b12, double letter, empty" [disabled] [ref=e363]:
                - generic [ref=e364]: 2L
              - button "c12, empty" [disabled] [ref=e365]
              - button "2W, d12, double word, empty" [disabled] [ref=e366]:
                - generic [ref=e367]: 2W
              - button "e12, empty" [disabled] [ref=e368]
              - button "f12, empty" [disabled] [ref=e369]
              - button "g12, empty" [disabled] [ref=e370]
              - button "h12, empty" [disabled] [ref=e371]
              - button "i12, empty" [disabled] [ref=e372]
              - button "j12, empty" [disabled] [ref=e373]
              - button "k12, empty" [disabled] [ref=e374]
              - button "2W, l12, double word, empty" [disabled] [ref=e375]:
                - generic [ref=e376]: 2W
              - button "m12, empty" [disabled] [ref=e377]
              - button "2L, n12, double letter, empty" [disabled] [ref=e378]:
                - generic [ref=e379]: 2L
              - button "o12, empty" [disabled] [ref=e380]
              - generic [ref=e381]: "13"
              - button "a13, empty" [disabled] [ref=e382]
              - button "b13, empty" [disabled] [ref=e383]
              - button "c13, empty" [disabled] [ref=e384]
              - button "d13, empty" [disabled] [ref=e385]
              - button "3L, e13, triple letter, empty" [disabled] [ref=e386]:
                - generic [ref=e387]: 3L
              - button "f13, empty" [disabled] [ref=e388]
              - button "g13, empty" [disabled] [ref=e389]
              - button "h13, empty" [disabled] [ref=e390]
              - button "i13, empty" [disabled] [ref=e391]
              - button "j13, empty" [disabled] [ref=e392]
              - button "3L, k13, triple letter, empty" [disabled] [ref=e393]:
                - generic [ref=e394]: 3L
              - button "l13, empty" [disabled] [ref=e395]
              - button "m13, empty" [disabled] [ref=e396]
              - button "n13, empty" [disabled] [ref=e397]
              - button "o13, empty" [disabled] [ref=e398]
              - generic [ref=e399]: "14"
              - button "a14, empty" [disabled] [ref=e400]
              - button "b14, empty" [disabled] [ref=e401]
              - button "c14, empty" [disabled] [ref=e402]
              - button "2L, d14, double letter, empty" [disabled] [ref=e403]:
                - generic [ref=e404]: 2L
              - button "e14, empty" [disabled] [ref=e405]
              - button "f14, empty" [disabled] [ref=e406]
              - button "2W, g14, double word, empty" [disabled] [ref=e407]:
                - generic [ref=e408]: 2W
              - button "h14, empty" [disabled] [ref=e409]
              - button "2W, i14, double word, empty" [disabled] [ref=e410]:
                - generic [ref=e411]: 2W
              - button "j14, empty" [disabled] [ref=e412]
              - button "k14, empty" [disabled] [ref=e413]
              - button "2L, l14, double letter, empty" [disabled] [ref=e414]:
                - generic [ref=e415]: 2L
              - button "m14, empty" [disabled] [ref=e416]
              - button "n14, empty" [disabled] [ref=e417]
              - button "o14, empty" [disabled] [ref=e418]
              - generic [ref=e419]: "15"
              - button "2L, a15, double letter, empty" [disabled] [ref=e420]:
                - generic [ref=e421]: 2L
              - button "b15, empty" [disabled] [ref=e422]
              - button "c15, empty" [disabled] [ref=e423]
              - button "d15, empty" [disabled] [ref=e424]
              - button "3W, e15, triple word, empty" [disabled] [ref=e425]:
                - generic [ref=e426]: 3W
              - button "f15, empty" [disabled] [ref=e427]
              - button "g15, empty" [disabled] [ref=e428]
              - button "2L, h15, double letter, empty" [disabled] [ref=e429]:
                - generic [ref=e430]: 2L
              - button "i15, empty" [disabled] [ref=e431]
              - button "j15, empty" [disabled] [ref=e432]
              - button "3W, k15, triple word, empty" [disabled] [ref=e433]:
                - generic [ref=e434]: 3W
              - button "l15, empty" [disabled] [ref=e435]
              - button "m15, empty" [disabled] [ref=e436]
              - button "n15, empty" [disabled] [ref=e437]
              - button "2L, o15, double letter, empty" [disabled] [ref=e438]:
                - generic [ref=e439]: 2L
          - paragraph [ref=e440]: S 1, j8, committed
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