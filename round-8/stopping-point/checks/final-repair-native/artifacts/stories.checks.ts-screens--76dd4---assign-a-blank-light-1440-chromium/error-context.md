# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--assign-a-blank light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  264421 pixels (ratio 0.22 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/assign-a-blank-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 264421 pixels (ratio 0.22 of all image pixels) are different.
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
  - 264421 pixels (ratio 0.22 of all image pixels) are different.

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
      - generic [ref=e93]:
        - generic [ref=e94]:
          - heading "Word Tiles" [level=1] [ref=e97]
          - generic [ref=e99]:
            - generic [ref=e100]: Unrated
            - generic [ref=e101]: ·Untimed
        - generic [ref=e103]:
          - generic [ref=e105]:
            - generic [ref=e107]:
              - generic [ref=e111]:
                - generic [ref=e112]:
                  - img "Teal" [ref=e113]
                  - generic "jordan_plays" [ref=e116]
                - generic [ref=e119]: 7 tiles
              - generic [ref=e120]:
                - generic [ref=e121]: Score
                - generic [ref=e122]: "0"
            - generic [ref=e124]:
              - group "Your rack" [ref=e125]:
                - button "C, 3 points" [ref=e126] [cursor=pointer]:
                  - generic [ref=e127]: C
                  - generic [ref=e128]: "3"
                - button "A, 1 points" [ref=e129] [cursor=pointer]:
                  - generic [ref=e130]: A
                  - generic [ref=e131]: "1"
                - button "T, 1 points" [ref=e132] [cursor=pointer]:
                  - generic [ref=e133]: T
                  - generic [ref=e134]: "1"
                - button "Blank, 0 points, on the board" [disabled] [ref=e135]
                - button "E, 1 points" [ref=e136] [cursor=pointer]:
                  - generic [ref=e137]: E
                  - generic [ref=e138]: "1"
                - button "S, 1 points" [ref=e139] [cursor=pointer]:
                  - generic [ref=e140]: S
                  - generic [ref=e141]: "1"
                - button "Q, 10 points" [ref=e142] [cursor=pointer]:
                  - generic [ref=e143]: Q
                  - generic [ref=e144]: "10"
              - generic [ref=e145]:
                - group "Word actions" [ref=e147]:
                  - button "Play word" [disabled] [ref=e148]:
                    - paragraph [ref=e151]: Play word
                  - button "Pass, exchange & tools" [ref=e152] [cursor=pointer]:
                    - paragraph [ref=e155]: Pass, exchange & tools
                - status [ref=e158]: Words have at least two letters.
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - button "Fit board" [pressed] [ref=e161] [cursor=pointer]:
                    - paragraph [ref=e164]: Fit board
                  - button "Enlarge board" [ref=e165] [cursor=pointer]:
                    - paragraph [ref=e168]: Enlarge board
                - region "Scrollable word board" [ref=e170]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e171]:
                    - generic [ref=e173]: a
                    - generic [ref=e174]: b
                    - generic [ref=e175]: c
                    - generic [ref=e176]: d
                    - generic [ref=e177]: e
                    - generic [ref=e178]: f
                    - generic [ref=e179]: g
                    - generic [ref=e180]: h
                    - generic [ref=e181]: i
                    - generic [ref=e182]: j
                    - generic [ref=e183]: k
                    - generic [ref=e184]: l
                    - generic [ref=e185]: m
                    - generic [ref=e186]: "n"
                    - generic [ref=e187]: o
                    - generic [ref=e188]: "1"
                    - button "2L, a1, double letter, empty" [ref=e189] [cursor=pointer]:
                      - generic [ref=e190]: 2L
                    - button "b1, empty" [ref=e191] [cursor=pointer]
                    - button "c1, empty" [ref=e192] [cursor=pointer]
                    - button "d1, empty" [ref=e193] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e194] [cursor=pointer]:
                      - generic [ref=e195]: 3W
                    - button "f1, empty" [ref=e196] [cursor=pointer]
                    - button "g1, empty" [ref=e197] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e198] [cursor=pointer]:
                      - generic [ref=e199]: 2L
                    - button "i1, empty" [ref=e200] [cursor=pointer]
                    - button "j1, empty" [ref=e201] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e202] [cursor=pointer]:
                      - generic [ref=e203]: 3W
                    - button "l1, empty" [ref=e204] [cursor=pointer]
                    - button "m1, empty" [ref=e205] [cursor=pointer]
                    - button "n1, empty" [ref=e206] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e207] [cursor=pointer]:
                      - generic [ref=e208]: 2L
                    - generic [ref=e209]: "2"
                    - button "a2, empty" [ref=e210] [cursor=pointer]
                    - button "b2, empty" [ref=e211] [cursor=pointer]
                    - button "c2, empty" [ref=e212] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e213] [cursor=pointer]:
                      - generic [ref=e214]: 2L
                    - button "e2, empty" [ref=e215] [cursor=pointer]
                    - button "f2, empty" [ref=e216] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e217] [cursor=pointer]:
                      - generic [ref=e218]: 2W
                    - button "h2, empty" [ref=e219] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e220] [cursor=pointer]:
                      - generic [ref=e221]: 2W
                    - button "j2, empty" [ref=e222] [cursor=pointer]
                    - button "k2, empty" [ref=e223] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e224] [cursor=pointer]:
                      - generic [ref=e225]: 2L
                    - button "m2, empty" [ref=e226] [cursor=pointer]
                    - button "n2, empty" [ref=e227] [cursor=pointer]
                    - button "o2, empty" [ref=e228] [cursor=pointer]
                    - generic [ref=e229]: "3"
                    - button "a3, empty" [ref=e230] [cursor=pointer]
                    - button "b3, empty" [ref=e231] [cursor=pointer]
                    - button "c3, empty" [ref=e232] [cursor=pointer]
                    - button "d3, empty" [ref=e233] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e234] [cursor=pointer]:
                      - generic [ref=e235]: 3L
                    - button "f3, empty" [ref=e236] [cursor=pointer]
                    - button "g3, empty" [ref=e237] [cursor=pointer]
                    - button "h3, empty" [ref=e238] [cursor=pointer]
                    - button "i3, empty" [ref=e239] [cursor=pointer]
                    - button "j3, empty" [ref=e240] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e241] [cursor=pointer]:
                      - generic [ref=e242]: 3L
                    - button "l3, empty" [ref=e243] [cursor=pointer]
                    - button "m3, empty" [ref=e244] [cursor=pointer]
                    - button "n3, empty" [ref=e245] [cursor=pointer]
                    - button "o3, empty" [ref=e246] [cursor=pointer]
                    - generic [ref=e247]: "4"
                    - button "a4, empty" [ref=e248] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e249] [cursor=pointer]:
                      - generic [ref=e250]: 2L
                    - button "c4, empty" [ref=e251] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e252] [cursor=pointer]:
                      - generic [ref=e253]: 2W
                    - button "e4, empty" [ref=e254] [cursor=pointer]
                    - button "f4, empty" [ref=e255] [cursor=pointer]
                    - button "g4, empty" [ref=e256] [cursor=pointer]
                    - button "h4, empty" [ref=e257] [cursor=pointer]
                    - button "i4, empty" [ref=e258] [cursor=pointer]
                    - button "j4, empty" [ref=e259] [cursor=pointer]
                    - button "k4, empty" [ref=e260] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e261] [cursor=pointer]:
                      - generic [ref=e262]: 2W
                    - button "m4, empty" [ref=e263] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e264] [cursor=pointer]:
                      - generic [ref=e265]: 2L
                    - button "o4, empty" [ref=e266] [cursor=pointer]
                    - generic [ref=e267]: "5"
                    - button "3W, a5, triple word, empty" [ref=e268] [cursor=pointer]:
                      - generic [ref=e269]: 3W
                    - button "b5, empty" [ref=e270] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e271] [cursor=pointer]:
                      - generic [ref=e272]: 3L
                    - button "d5, empty" [ref=e273] [cursor=pointer]
                    - button "e5, empty" [ref=e274] [cursor=pointer]
                    - button "f5, empty" [ref=e275] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e276] [cursor=pointer]:
                      - generic [ref=e277]: 2L
                    - button "h5, empty" [ref=e278] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e279] [cursor=pointer]:
                      - generic [ref=e280]: 2L
                    - button "j5, empty" [ref=e281] [cursor=pointer]
                    - button "k5, empty" [ref=e282] [cursor=pointer]
                    - button "l5, empty" [ref=e283] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e284] [cursor=pointer]:
                      - generic [ref=e285]: 3L
                    - button "n5, empty" [ref=e286] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e287] [cursor=pointer]:
                      - generic [ref=e288]: 3W
                    - generic [ref=e289]: "6"
                    - button "a6, empty" [ref=e290] [cursor=pointer]
                    - button "b6, empty" [ref=e291] [cursor=pointer]
                    - button "c6, empty" [ref=e292] [cursor=pointer]
                    - button "d6, empty" [ref=e293] [cursor=pointer]
                    - button "e6, empty" [ref=e294] [cursor=pointer]
                    - button "f6, empty" [ref=e295] [cursor=pointer]
                    - button "g6, empty" [ref=e296] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e297] [cursor=pointer]:
                      - generic [ref=e298]: 3L
                    - button "i6, empty" [ref=e299] [cursor=pointer]
                    - button "j6, empty" [ref=e300] [cursor=pointer]
                    - button "k6, empty" [ref=e301] [cursor=pointer]
                    - button "l6, empty" [ref=e302] [cursor=pointer]
                    - button "m6, empty" [ref=e303] [cursor=pointer]
                    - button "n6, empty" [ref=e304] [cursor=pointer]
                    - button "o6, empty" [ref=e305] [cursor=pointer]
                    - generic [ref=e306]: "7"
                    - button "a7, empty" [ref=e307] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e308] [cursor=pointer]:
                      - generic [ref=e309]: 2W
                    - button "c7, empty" [ref=e310] [cursor=pointer]
                    - button "d7, empty" [ref=e311] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e312] [cursor=pointer]:
                      - generic [ref=e313]: 2L
                    - button "f7, empty" [ref=e314] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e315] [cursor=pointer]:
                      - generic [ref=e316]: 2L
                    - button "h7, empty" [ref=e317] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e318] [cursor=pointer]:
                      - generic [ref=e319]: 2L
                    - button "j7, empty" [ref=e320] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e321] [cursor=pointer]:
                      - generic [ref=e322]: 2L
                    - button "l7, empty" [ref=e323] [cursor=pointer]
                    - button "m7, empty" [ref=e324] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e325] [cursor=pointer]:
                      - generic [ref=e326]: 2W
                    - button "o7, empty" [ref=e327] [cursor=pointer]
                    - generic [ref=e328]: "8"
                    - button "2L, a8, double letter, empty" [ref=e329] [cursor=pointer]:
                      - generic [ref=e330]: 2L
                    - button "b8, empty" [ref=e331] [cursor=pointer]
                    - button "c8, empty" [ref=e332] [cursor=pointer]
                    - button "d8, empty" [ref=e333] [cursor=pointer]
                    - button "e8, empty" [ref=e334] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e335] [cursor=pointer]:
                      - generic [ref=e336]: 3L
                    - button "g8, empty" [ref=e337] [cursor=pointer]
                    - button "E 0, h8, your tentative blank as E" [active] [ref=e338] [cursor=pointer]:
                      - generic [ref=e339]: E
                    - button "i8, empty" [ref=e340] [cursor=pointer]
                    - button "3L, j8, triple letter, empty" [ref=e341] [cursor=pointer]:
                      - generic [ref=e342]: 3L
                    - button "k8, empty" [ref=e343] [cursor=pointer]
                    - button "l8, empty" [ref=e344] [cursor=pointer]
                    - button "m8, empty" [ref=e345] [cursor=pointer]
                    - button "n8, empty" [ref=e346] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e347] [cursor=pointer]:
                      - generic [ref=e348]: 2L
                    - generic [ref=e349]: "9"
                    - button "a9, empty" [ref=e350] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e351] [cursor=pointer]:
                      - generic [ref=e352]: 2W
                    - button "c9, empty" [ref=e353] [cursor=pointer]
                    - button "d9, empty" [ref=e354] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e355] [cursor=pointer]:
                      - generic [ref=e356]: 2L
                    - button "f9, empty" [ref=e357] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e358] [cursor=pointer]:
                      - generic [ref=e359]: 2L
                    - button "h9, empty" [ref=e360] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e361] [cursor=pointer]:
                      - generic [ref=e362]: 2L
                    - button "j9, empty" [ref=e363] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e364] [cursor=pointer]:
                      - generic [ref=e365]: 2L
                    - button "l9, empty" [ref=e366] [cursor=pointer]
                    - button "m9, empty" [ref=e367] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e368] [cursor=pointer]:
                      - generic [ref=e369]: 2W
                    - button "o9, empty" [ref=e370] [cursor=pointer]
                    - generic [ref=e371]: "10"
                    - button "a10, empty" [ref=e372] [cursor=pointer]
                    - button "b10, empty" [ref=e373] [cursor=pointer]
                    - button "c10, empty" [ref=e374] [cursor=pointer]
                    - button "d10, empty" [ref=e375] [cursor=pointer]
                    - button "e10, empty" [ref=e376] [cursor=pointer]
                    - button "f10, empty" [ref=e377] [cursor=pointer]
                    - button "g10, empty" [ref=e378] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e379] [cursor=pointer]:
                      - generic [ref=e380]: 3L
                    - button "i10, empty" [ref=e381] [cursor=pointer]
                    - button "j10, empty" [ref=e382] [cursor=pointer]
                    - button "k10, empty" [ref=e383] [cursor=pointer]
                    - button "l10, empty" [ref=e384] [cursor=pointer]
                    - button "m10, empty" [ref=e385] [cursor=pointer]
                    - button "n10, empty" [ref=e386] [cursor=pointer]
                    - button "o10, empty" [ref=e387] [cursor=pointer]
                    - generic [ref=e388]: "11"
                    - button "3W, a11, triple word, empty" [ref=e389] [cursor=pointer]:
                      - generic [ref=e390]: 3W
                    - button "b11, empty" [ref=e391] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e392] [cursor=pointer]:
                      - generic [ref=e393]: 3L
                    - button "d11, empty" [ref=e394] [cursor=pointer]
                    - button "e11, empty" [ref=e395] [cursor=pointer]
                    - button "f11, empty" [ref=e396] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e397] [cursor=pointer]:
                      - generic [ref=e398]: 2L
                    - button "h11, empty" [ref=e399] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e400] [cursor=pointer]:
                      - generic [ref=e401]: 2L
                    - button "j11, empty" [ref=e402] [cursor=pointer]
                    - button "k11, empty" [ref=e403] [cursor=pointer]
                    - button "l11, empty" [ref=e404] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e405] [cursor=pointer]:
                      - generic [ref=e406]: 3L
                    - button "n11, empty" [ref=e407] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e408] [cursor=pointer]:
                      - generic [ref=e409]: 3W
                    - generic [ref=e410]: "12"
                    - button "a12, empty" [ref=e411] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e412] [cursor=pointer]:
                      - generic [ref=e413]: 2L
                    - button "c12, empty" [ref=e414] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e415] [cursor=pointer]:
                      - generic [ref=e416]: 2W
                    - button "e12, empty" [ref=e417] [cursor=pointer]
                    - button "f12, empty" [ref=e418] [cursor=pointer]
                    - button "g12, empty" [ref=e419] [cursor=pointer]
                    - button "h12, empty" [ref=e420] [cursor=pointer]
                    - button "i12, empty" [ref=e421] [cursor=pointer]
                    - button "j12, empty" [ref=e422] [cursor=pointer]
                    - button "k12, empty" [ref=e423] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e424] [cursor=pointer]:
                      - generic [ref=e425]: 2W
                    - button "m12, empty" [ref=e426] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e427] [cursor=pointer]:
                      - generic [ref=e428]: 2L
                    - button "o12, empty" [ref=e429] [cursor=pointer]
                    - generic [ref=e430]: "13"
                    - button "a13, empty" [ref=e431] [cursor=pointer]
                    - button "b13, empty" [ref=e432] [cursor=pointer]
                    - button "c13, empty" [ref=e433] [cursor=pointer]
                    - button "d13, empty" [ref=e434] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e435] [cursor=pointer]:
                      - generic [ref=e436]: 3L
                    - button "f13, empty" [ref=e437] [cursor=pointer]
                    - button "g13, empty" [ref=e438] [cursor=pointer]
                    - button "h13, empty" [ref=e439] [cursor=pointer]
                    - button "i13, empty" [ref=e440] [cursor=pointer]
                    - button "j13, empty" [ref=e441] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e442] [cursor=pointer]:
                      - generic [ref=e443]: 3L
                    - button "l13, empty" [ref=e444] [cursor=pointer]
                    - button "m13, empty" [ref=e445] [cursor=pointer]
                    - button "n13, empty" [ref=e446] [cursor=pointer]
                    - button "o13, empty" [ref=e447] [cursor=pointer]
                    - generic [ref=e448]: "14"
                    - button "a14, empty" [ref=e449] [cursor=pointer]
                    - button "b14, empty" [ref=e450] [cursor=pointer]
                    - button "c14, empty" [ref=e451] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e452] [cursor=pointer]:
                      - generic [ref=e453]: 2L
                    - button "e14, empty" [ref=e454] [cursor=pointer]
                    - button "f14, empty" [ref=e455] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e456] [cursor=pointer]:
                      - generic [ref=e457]: 2W
                    - button "h14, empty" [ref=e458] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e459] [cursor=pointer]:
                      - generic [ref=e460]: 2W
                    - button "j14, empty" [ref=e461] [cursor=pointer]
                    - button "k14, empty" [ref=e462] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e463] [cursor=pointer]:
                      - generic [ref=e464]: 2L
                    - button "m14, empty" [ref=e465] [cursor=pointer]
                    - button "n14, empty" [ref=e466] [cursor=pointer]
                    - button "o14, empty" [ref=e467] [cursor=pointer]
                    - generic [ref=e468]: "15"
                    - button "2L, a15, double letter, empty" [ref=e469] [cursor=pointer]:
                      - generic [ref=e470]: 2L
                    - button "b15, empty" [ref=e471] [cursor=pointer]
                    - button "c15, empty" [ref=e472] [cursor=pointer]
                    - button "d15, empty" [ref=e473] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e474] [cursor=pointer]:
                      - generic [ref=e475]: 3W
                    - button "f15, empty" [ref=e476] [cursor=pointer]
                    - button "g15, empty" [ref=e477] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e478] [cursor=pointer]:
                      - generic [ref=e479]: 2L
                    - button "i15, empty" [ref=e480] [cursor=pointer]
                    - button "j15, empty" [ref=e481] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e482] [cursor=pointer]:
                      - generic [ref=e483]: 3W
                    - button "l15, empty" [ref=e484] [cursor=pointer]
                    - button "m15, empty" [ref=e485] [cursor=pointer]
                    - button "n15, empty" [ref=e486] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e487] [cursor=pointer]:
                      - generic [ref=e488]: 2L
                - paragraph [ref=e489]: E 0, h8, your tentative blank as E
            - status [ref=e491]:
              - generic [ref=e492]:
                - generic [ref=e493]: "Amber: avery. Teal: jordan_plays."
                - text: Amber — to play · 86 tiles in the bag
            - generic [ref=e496]:
              - generic [ref=e500]:
                - generic [ref=e501]:
                  - img "Amber" [ref=e502]
                  - generic "avery" [ref=e505]
                  - generic [ref=e506]: Your move
                - generic [ref=e509]: 7 tiles
              - generic [ref=e510]:
                - generic [ref=e511]: Score
                - generic [ref=e512]: "0"
          - region "Game record" [ref=e515]:
            - generic [ref=e516]:
              - heading "Game record" [level=2] [ref=e518]
              - paragraph [ref=e519]: Amber — to play · 86 tiles in the bag
            - paragraph [ref=e522]: Live
            - generic [ref=e524]:
              - group "Game actions" [ref=e525]:
                - button "Offer draw" [ref=e526] [cursor=pointer]:
                  - paragraph [ref=e529]: Offer draw
                - button "Resign game" [ref=e530] [cursor=pointer]:
                  - paragraph [ref=e533]:
                    - text: Resign
                    - generic [ref=e534]: game
              - button "History and stats" [ref=e535] [cursor=pointer]:
                - paragraph [ref=e538]: History and stats
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