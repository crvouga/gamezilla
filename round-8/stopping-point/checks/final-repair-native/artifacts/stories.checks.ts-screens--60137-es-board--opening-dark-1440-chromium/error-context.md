# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--opening dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  124630 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/opening-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/opening-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 124630 pixels (ratio 0.11 of all image pixels) are different.
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
  - 124630 pixels (ratio 0.11 of all image pixels) are different.

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
                - button "Blank, 0 points" [ref=e135] [cursor=pointer]:
                  - generic [ref=e136]: "0"
                - button "E, 1 points" [ref=e137] [cursor=pointer]:
                  - generic [ref=e138]: E
                  - generic [ref=e139]: "1"
                - button "S, 1 points" [ref=e140] [cursor=pointer]:
                  - generic [ref=e141]: S
                  - generic [ref=e142]: "1"
                - button "Q, 10 points" [ref=e143] [cursor=pointer]:
                  - generic [ref=e144]: Q
                  - generic [ref=e145]: "10"
              - generic [ref=e146]:
                - group "Word actions" [ref=e148]:
                  - button "Play word" [disabled] [ref=e149]:
                    - paragraph [ref=e152]: Play word
                  - button "Pass, exchange & tools" [ref=e153] [cursor=pointer]:
                    - paragraph [ref=e156]: Pass, exchange & tools
                - status [ref=e159]: Choose a tile, then a square.
              - generic [ref=e160]:
                - generic [ref=e161]:
                  - button "Fit board" [pressed] [ref=e162] [cursor=pointer]:
                    - paragraph [ref=e165]: Fit board
                  - button "Enlarge board" [ref=e166] [cursor=pointer]:
                    - paragraph [ref=e169]: Enlarge board
                - region "Scrollable word board" [ref=e171]:
                  - group "Word board, fifteen columns and fifteen rows" [ref=e172]:
                    - generic [ref=e174]: a
                    - generic [ref=e175]: b
                    - generic [ref=e176]: c
                    - generic [ref=e177]: d
                    - generic [ref=e178]: e
                    - generic [ref=e179]: f
                    - generic [ref=e180]: g
                    - generic [ref=e181]: h
                    - generic [ref=e182]: i
                    - generic [ref=e183]: j
                    - generic [ref=e184]: k
                    - generic [ref=e185]: l
                    - generic [ref=e186]: m
                    - generic [ref=e187]: "n"
                    - generic [ref=e188]: o
                    - generic [ref=e189]: "1"
                    - button "2L, a1, double letter, empty" [ref=e190] [cursor=pointer]:
                      - generic [ref=e191]: 2L
                    - button "b1, empty" [ref=e192] [cursor=pointer]
                    - button "c1, empty" [ref=e193] [cursor=pointer]
                    - button "d1, empty" [ref=e194] [cursor=pointer]
                    - button "3W, e1, triple word, empty" [ref=e195] [cursor=pointer]:
                      - generic [ref=e196]: 3W
                    - button "f1, empty" [ref=e197] [cursor=pointer]
                    - button "g1, empty" [ref=e198] [cursor=pointer]
                    - button "2L, h1, double letter, empty" [ref=e199] [cursor=pointer]:
                      - generic [ref=e200]: 2L
                    - button "i1, empty" [ref=e201] [cursor=pointer]
                    - button "j1, empty" [ref=e202] [cursor=pointer]
                    - button "3W, k1, triple word, empty" [ref=e203] [cursor=pointer]:
                      - generic [ref=e204]: 3W
                    - button "l1, empty" [ref=e205] [cursor=pointer]
                    - button "m1, empty" [ref=e206] [cursor=pointer]
                    - button "n1, empty" [ref=e207] [cursor=pointer]
                    - button "2L, o1, double letter, empty" [ref=e208] [cursor=pointer]:
                      - generic [ref=e209]: 2L
                    - generic [ref=e210]: "2"
                    - button "a2, empty" [ref=e211] [cursor=pointer]
                    - button "b2, empty" [ref=e212] [cursor=pointer]
                    - button "c2, empty" [ref=e213] [cursor=pointer]
                    - button "2L, d2, double letter, empty" [ref=e214] [cursor=pointer]:
                      - generic [ref=e215]: 2L
                    - button "e2, empty" [ref=e216] [cursor=pointer]
                    - button "f2, empty" [ref=e217] [cursor=pointer]
                    - button "2W, g2, double word, empty" [ref=e218] [cursor=pointer]:
                      - generic [ref=e219]: 2W
                    - button "h2, empty" [ref=e220] [cursor=pointer]
                    - button "2W, i2, double word, empty" [ref=e221] [cursor=pointer]:
                      - generic [ref=e222]: 2W
                    - button "j2, empty" [ref=e223] [cursor=pointer]
                    - button "k2, empty" [ref=e224] [cursor=pointer]
                    - button "2L, l2, double letter, empty" [ref=e225] [cursor=pointer]:
                      - generic [ref=e226]: 2L
                    - button "m2, empty" [ref=e227] [cursor=pointer]
                    - button "n2, empty" [ref=e228] [cursor=pointer]
                    - button "o2, empty" [ref=e229] [cursor=pointer]
                    - generic [ref=e230]: "3"
                    - button "a3, empty" [ref=e231] [cursor=pointer]
                    - button "b3, empty" [ref=e232] [cursor=pointer]
                    - button "c3, empty" [ref=e233] [cursor=pointer]
                    - button "d3, empty" [ref=e234] [cursor=pointer]
                    - button "3L, e3, triple letter, empty" [ref=e235] [cursor=pointer]:
                      - generic [ref=e236]: 3L
                    - button "f3, empty" [ref=e237] [cursor=pointer]
                    - button "g3, empty" [ref=e238] [cursor=pointer]
                    - button "h3, empty" [ref=e239] [cursor=pointer]
                    - button "i3, empty" [ref=e240] [cursor=pointer]
                    - button "j3, empty" [ref=e241] [cursor=pointer]
                    - button "3L, k3, triple letter, empty" [ref=e242] [cursor=pointer]:
                      - generic [ref=e243]: 3L
                    - button "l3, empty" [ref=e244] [cursor=pointer]
                    - button "m3, empty" [ref=e245] [cursor=pointer]
                    - button "n3, empty" [ref=e246] [cursor=pointer]
                    - button "o3, empty" [ref=e247] [cursor=pointer]
                    - generic [ref=e248]: "4"
                    - button "a4, empty" [ref=e249] [cursor=pointer]
                    - button "2L, b4, double letter, empty" [ref=e250] [cursor=pointer]:
                      - generic [ref=e251]: 2L
                    - button "c4, empty" [ref=e252] [cursor=pointer]
                    - button "2W, d4, double word, empty" [ref=e253] [cursor=pointer]:
                      - generic [ref=e254]: 2W
                    - button "e4, empty" [ref=e255] [cursor=pointer]
                    - button "f4, empty" [ref=e256] [cursor=pointer]
                    - button "g4, empty" [ref=e257] [cursor=pointer]
                    - button "h4, empty" [ref=e258] [cursor=pointer]
                    - button "i4, empty" [ref=e259] [cursor=pointer]
                    - button "j4, empty" [ref=e260] [cursor=pointer]
                    - button "k4, empty" [ref=e261] [cursor=pointer]
                    - button "2W, l4, double word, empty" [ref=e262] [cursor=pointer]:
                      - generic [ref=e263]: 2W
                    - button "m4, empty" [ref=e264] [cursor=pointer]
                    - button "2L, n4, double letter, empty" [ref=e265] [cursor=pointer]:
                      - generic [ref=e266]: 2L
                    - button "o4, empty" [ref=e267] [cursor=pointer]
                    - generic [ref=e268]: "5"
                    - button "3W, a5, triple word, empty" [ref=e269] [cursor=pointer]:
                      - generic [ref=e270]: 3W
                    - button "b5, empty" [ref=e271] [cursor=pointer]
                    - button "3L, c5, triple letter, empty" [ref=e272] [cursor=pointer]:
                      - generic [ref=e273]: 3L
                    - button "d5, empty" [ref=e274] [cursor=pointer]
                    - button "e5, empty" [ref=e275] [cursor=pointer]
                    - button "f5, empty" [ref=e276] [cursor=pointer]
                    - button "2L, g5, double letter, empty" [ref=e277] [cursor=pointer]:
                      - generic [ref=e278]: 2L
                    - button "h5, empty" [ref=e279] [cursor=pointer]
                    - button "2L, i5, double letter, empty" [ref=e280] [cursor=pointer]:
                      - generic [ref=e281]: 2L
                    - button "j5, empty" [ref=e282] [cursor=pointer]
                    - button "k5, empty" [ref=e283] [cursor=pointer]
                    - button "l5, empty" [ref=e284] [cursor=pointer]
                    - button "3L, m5, triple letter, empty" [ref=e285] [cursor=pointer]:
                      - generic [ref=e286]: 3L
                    - button "n5, empty" [ref=e287] [cursor=pointer]
                    - button "3W, o5, triple word, empty" [ref=e288] [cursor=pointer]:
                      - generic [ref=e289]: 3W
                    - generic [ref=e290]: "6"
                    - button "a6, empty" [ref=e291] [cursor=pointer]
                    - button "b6, empty" [ref=e292] [cursor=pointer]
                    - button "c6, empty" [ref=e293] [cursor=pointer]
                    - button "d6, empty" [ref=e294] [cursor=pointer]
                    - button "e6, empty" [ref=e295] [cursor=pointer]
                    - button "f6, empty" [ref=e296] [cursor=pointer]
                    - button "g6, empty" [ref=e297] [cursor=pointer]
                    - button "3L, h6, triple letter, empty" [ref=e298] [cursor=pointer]:
                      - generic [ref=e299]: 3L
                    - button "i6, empty" [ref=e300] [cursor=pointer]
                    - button "j6, empty" [ref=e301] [cursor=pointer]
                    - button "k6, empty" [ref=e302] [cursor=pointer]
                    - button "l6, empty" [ref=e303] [cursor=pointer]
                    - button "m6, empty" [ref=e304] [cursor=pointer]
                    - button "n6, empty" [ref=e305] [cursor=pointer]
                    - button "o6, empty" [ref=e306] [cursor=pointer]
                    - generic [ref=e307]: "7"
                    - button "a7, empty" [ref=e308] [cursor=pointer]
                    - button "2W, b7, double word, empty" [ref=e309] [cursor=pointer]:
                      - generic [ref=e310]: 2W
                    - button "c7, empty" [ref=e311] [cursor=pointer]
                    - button "d7, empty" [ref=e312] [cursor=pointer]
                    - button "2L, e7, double letter, empty" [ref=e313] [cursor=pointer]:
                      - generic [ref=e314]: 2L
                    - button "f7, empty" [ref=e315] [cursor=pointer]
                    - button "2L, g7, double letter, empty" [ref=e316] [cursor=pointer]:
                      - generic [ref=e317]: 2L
                    - button "h7, empty" [ref=e318] [cursor=pointer]
                    - button "2L, i7, double letter, empty" [ref=e319] [cursor=pointer]:
                      - generic [ref=e320]: 2L
                    - button "j7, empty" [ref=e321] [cursor=pointer]
                    - button "2L, k7, double letter, empty" [ref=e322] [cursor=pointer]:
                      - generic [ref=e323]: 2L
                    - button "l7, empty" [ref=e324] [cursor=pointer]
                    - button "m7, empty" [ref=e325] [cursor=pointer]
                    - button "2W, n7, double word, empty" [ref=e326] [cursor=pointer]:
                      - generic [ref=e327]: 2W
                    - button "o7, empty" [ref=e328] [cursor=pointer]
                    - generic [ref=e329]: "8"
                    - button "2L, a8, double letter, empty" [ref=e330] [cursor=pointer]:
                      - generic [ref=e331]: 2L
                    - button "b8, empty" [ref=e332] [cursor=pointer]
                    - button "c8, empty" [ref=e333] [cursor=pointer]
                    - button "d8, empty" [ref=e334] [cursor=pointer]
                    - button "e8, empty" [ref=e335] [cursor=pointer]
                    - button "3L, f8, triple letter, empty" [ref=e336] [cursor=pointer]:
                      - generic [ref=e337]: 3L
                    - button "g8, empty" [ref=e338] [cursor=pointer]
                    - button "★, h8, start, double word, empty" [ref=e339] [cursor=pointer]:
                      - generic [ref=e340]: ★
                    - button "i8, empty" [ref=e341] [cursor=pointer]
                    - button "3L, j8, triple letter, empty" [ref=e342] [cursor=pointer]:
                      - generic [ref=e343]: 3L
                    - button "k8, empty" [ref=e344] [cursor=pointer]
                    - button "l8, empty" [ref=e345] [cursor=pointer]
                    - button "m8, empty" [ref=e346] [cursor=pointer]
                    - button "n8, empty" [ref=e347] [cursor=pointer]
                    - button "2L, o8, double letter, empty" [ref=e348] [cursor=pointer]:
                      - generic [ref=e349]: 2L
                    - generic [ref=e350]: "9"
                    - button "a9, empty" [ref=e351] [cursor=pointer]
                    - button "2W, b9, double word, empty" [ref=e352] [cursor=pointer]:
                      - generic [ref=e353]: 2W
                    - button "c9, empty" [ref=e354] [cursor=pointer]
                    - button "d9, empty" [ref=e355] [cursor=pointer]
                    - button "2L, e9, double letter, empty" [ref=e356] [cursor=pointer]:
                      - generic [ref=e357]: 2L
                    - button "f9, empty" [ref=e358] [cursor=pointer]
                    - button "2L, g9, double letter, empty" [ref=e359] [cursor=pointer]:
                      - generic [ref=e360]: 2L
                    - button "h9, empty" [ref=e361] [cursor=pointer]
                    - button "2L, i9, double letter, empty" [ref=e362] [cursor=pointer]:
                      - generic [ref=e363]: 2L
                    - button "j9, empty" [ref=e364] [cursor=pointer]
                    - button "2L, k9, double letter, empty" [ref=e365] [cursor=pointer]:
                      - generic [ref=e366]: 2L
                    - button "l9, empty" [ref=e367] [cursor=pointer]
                    - button "m9, empty" [ref=e368] [cursor=pointer]
                    - button "2W, n9, double word, empty" [ref=e369] [cursor=pointer]:
                      - generic [ref=e370]: 2W
                    - button "o9, empty" [ref=e371] [cursor=pointer]
                    - generic [ref=e372]: "10"
                    - button "a10, empty" [ref=e373] [cursor=pointer]
                    - button "b10, empty" [ref=e374] [cursor=pointer]
                    - button "c10, empty" [ref=e375] [cursor=pointer]
                    - button "d10, empty" [ref=e376] [cursor=pointer]
                    - button "e10, empty" [ref=e377] [cursor=pointer]
                    - button "f10, empty" [ref=e378] [cursor=pointer]
                    - button "g10, empty" [ref=e379] [cursor=pointer]
                    - button "3L, h10, triple letter, empty" [ref=e380] [cursor=pointer]:
                      - generic [ref=e381]: 3L
                    - button "i10, empty" [ref=e382] [cursor=pointer]
                    - button "j10, empty" [ref=e383] [cursor=pointer]
                    - button "k10, empty" [ref=e384] [cursor=pointer]
                    - button "l10, empty" [ref=e385] [cursor=pointer]
                    - button "m10, empty" [ref=e386] [cursor=pointer]
                    - button "n10, empty" [ref=e387] [cursor=pointer]
                    - button "o10, empty" [ref=e388] [cursor=pointer]
                    - generic [ref=e389]: "11"
                    - button "3W, a11, triple word, empty" [ref=e390] [cursor=pointer]:
                      - generic [ref=e391]: 3W
                    - button "b11, empty" [ref=e392] [cursor=pointer]
                    - button "3L, c11, triple letter, empty" [ref=e393] [cursor=pointer]:
                      - generic [ref=e394]: 3L
                    - button "d11, empty" [ref=e395] [cursor=pointer]
                    - button "e11, empty" [ref=e396] [cursor=pointer]
                    - button "f11, empty" [ref=e397] [cursor=pointer]
                    - button "2L, g11, double letter, empty" [ref=e398] [cursor=pointer]:
                      - generic [ref=e399]: 2L
                    - button "h11, empty" [ref=e400] [cursor=pointer]
                    - button "2L, i11, double letter, empty" [ref=e401] [cursor=pointer]:
                      - generic [ref=e402]: 2L
                    - button "j11, empty" [ref=e403] [cursor=pointer]
                    - button "k11, empty" [ref=e404] [cursor=pointer]
                    - button "l11, empty" [ref=e405] [cursor=pointer]
                    - button "3L, m11, triple letter, empty" [ref=e406] [cursor=pointer]:
                      - generic [ref=e407]: 3L
                    - button "n11, empty" [ref=e408] [cursor=pointer]
                    - button "3W, o11, triple word, empty" [ref=e409] [cursor=pointer]:
                      - generic [ref=e410]: 3W
                    - generic [ref=e411]: "12"
                    - button "a12, empty" [ref=e412] [cursor=pointer]
                    - button "2L, b12, double letter, empty" [ref=e413] [cursor=pointer]:
                      - generic [ref=e414]: 2L
                    - button "c12, empty" [ref=e415] [cursor=pointer]
                    - button "2W, d12, double word, empty" [ref=e416] [cursor=pointer]:
                      - generic [ref=e417]: 2W
                    - button "e12, empty" [ref=e418] [cursor=pointer]
                    - button "f12, empty" [ref=e419] [cursor=pointer]
                    - button "g12, empty" [ref=e420] [cursor=pointer]
                    - button "h12, empty" [ref=e421] [cursor=pointer]
                    - button "i12, empty" [ref=e422] [cursor=pointer]
                    - button "j12, empty" [ref=e423] [cursor=pointer]
                    - button "k12, empty" [ref=e424] [cursor=pointer]
                    - button "2W, l12, double word, empty" [ref=e425] [cursor=pointer]:
                      - generic [ref=e426]: 2W
                    - button "m12, empty" [ref=e427] [cursor=pointer]
                    - button "2L, n12, double letter, empty" [ref=e428] [cursor=pointer]:
                      - generic [ref=e429]: 2L
                    - button "o12, empty" [ref=e430] [cursor=pointer]
                    - generic [ref=e431]: "13"
                    - button "a13, empty" [ref=e432] [cursor=pointer]
                    - button "b13, empty" [ref=e433] [cursor=pointer]
                    - button "c13, empty" [ref=e434] [cursor=pointer]
                    - button "d13, empty" [ref=e435] [cursor=pointer]
                    - button "3L, e13, triple letter, empty" [ref=e436] [cursor=pointer]:
                      - generic [ref=e437]: 3L
                    - button "f13, empty" [ref=e438] [cursor=pointer]
                    - button "g13, empty" [ref=e439] [cursor=pointer]
                    - button "h13, empty" [ref=e440] [cursor=pointer]
                    - button "i13, empty" [ref=e441] [cursor=pointer]
                    - button "j13, empty" [ref=e442] [cursor=pointer]
                    - button "3L, k13, triple letter, empty" [ref=e443] [cursor=pointer]:
                      - generic [ref=e444]: 3L
                    - button "l13, empty" [ref=e445] [cursor=pointer]
                    - button "m13, empty" [ref=e446] [cursor=pointer]
                    - button "n13, empty" [ref=e447] [cursor=pointer]
                    - button "o13, empty" [ref=e448] [cursor=pointer]
                    - generic [ref=e449]: "14"
                    - button "a14, empty" [ref=e450] [cursor=pointer]
                    - button "b14, empty" [ref=e451] [cursor=pointer]
                    - button "c14, empty" [ref=e452] [cursor=pointer]
                    - button "2L, d14, double letter, empty" [ref=e453] [cursor=pointer]:
                      - generic [ref=e454]: 2L
                    - button "e14, empty" [ref=e455] [cursor=pointer]
                    - button "f14, empty" [ref=e456] [cursor=pointer]
                    - button "2W, g14, double word, empty" [ref=e457] [cursor=pointer]:
                      - generic [ref=e458]: 2W
                    - button "h14, empty" [ref=e459] [cursor=pointer]
                    - button "2W, i14, double word, empty" [ref=e460] [cursor=pointer]:
                      - generic [ref=e461]: 2W
                    - button "j14, empty" [ref=e462] [cursor=pointer]
                    - button "k14, empty" [ref=e463] [cursor=pointer]
                    - button "2L, l14, double letter, empty" [ref=e464] [cursor=pointer]:
                      - generic [ref=e465]: 2L
                    - button "m14, empty" [ref=e466] [cursor=pointer]
                    - button "n14, empty" [ref=e467] [cursor=pointer]
                    - button "o14, empty" [ref=e468] [cursor=pointer]
                    - generic [ref=e469]: "15"
                    - button "2L, a15, double letter, empty" [ref=e470] [cursor=pointer]:
                      - generic [ref=e471]: 2L
                    - button "b15, empty" [ref=e472] [cursor=pointer]
                    - button "c15, empty" [ref=e473] [cursor=pointer]
                    - button "d15, empty" [ref=e474] [cursor=pointer]
                    - button "3W, e15, triple word, empty" [ref=e475] [cursor=pointer]:
                      - generic [ref=e476]: 3W
                    - button "f15, empty" [ref=e477] [cursor=pointer]
                    - button "g15, empty" [ref=e478] [cursor=pointer]
                    - button "2L, h15, double letter, empty" [ref=e479] [cursor=pointer]:
                      - generic [ref=e480]: 2L
                    - button "i15, empty" [ref=e481] [cursor=pointer]
                    - button "j15, empty" [ref=e482] [cursor=pointer]
                    - button "3W, k15, triple word, empty" [ref=e483] [cursor=pointer]:
                      - generic [ref=e484]: 3W
                    - button "l15, empty" [ref=e485] [cursor=pointer]
                    - button "m15, empty" [ref=e486] [cursor=pointer]
                    - button "n15, empty" [ref=e487] [cursor=pointer]
                    - button "2L, o15, double letter, empty" [ref=e488] [cursor=pointer]:
                      - generic [ref=e489]: 2L
                - paragraph [ref=e490]: ★, h8, start, double word, empty
            - status [ref=e492]:
              - generic [ref=e493]:
                - generic [ref=e494]: "Amber: avery. Teal: jordan_plays."
                - text: Amber — to play · 86 tiles in the bag
            - generic [ref=e497]:
              - generic [ref=e501]:
                - generic [ref=e502]:
                  - img "Amber" [ref=e503]
                  - generic "avery" [ref=e506]
                  - generic [ref=e507]: Your move
                - generic [ref=e510]: 7 tiles
              - generic [ref=e511]:
                - generic [ref=e512]: Score
                - generic [ref=e513]: "0"
          - region "Game record" [ref=e516]:
            - generic [ref=e517]:
              - heading "Game record" [level=2] [ref=e519]
              - paragraph [ref=e520]: Amber — to play · 86 tiles in the bag
            - paragraph [ref=e523]: Live
            - generic [ref=e525]:
              - group "Game actions" [ref=e526]:
                - button "Offer draw" [ref=e527] [cursor=pointer]:
                  - paragraph [ref=e530]: Offer draw
                - button "Resign game" [ref=e531] [cursor=pointer]:
                  - paragraph [ref=e534]:
                    - text: Resign
                    - generic [ref=e535]: game
              - button "History and stats" [ref=e536] [cursor=pointer]:
                - paragraph [ref=e539]: History and stats
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