# Final Ubuntu reference review

Revision `7580af910457dd99962c231b75ced6da14e681b1`; run [42227860547](https://github.com/crvouga/gamezilla/actions/runs/42227860547).

Authoring passed all 610 cases; comparison passed 605 and failed five at pixels. Readiness/play, page-error and serious/critical axe assertions reached pixels in every case. [Failures](failed-comparisons.json) preserve the public log's masked counts without guessing them.

The public log decoded into five PNG changes, all under `libs/word-tiles-client-ts`. All five actual authored PNGs were opened and inspected, alongside the two existing phone-light references. The exchange/pass images show differing post-action scroll offsets (the visible grid starts at different rows); this observation does not establish the failure's cause. There was no Word Tiles source change between the previous authoring run and this run. The other three patch images correspond to deliberately absent, previously disputed references. None is accepted. [Patch inventory and hashes](patch-inventory.json); [authored images](images); [encoded binary diff](authored-baselines.patch.gz).

Two additional existing references failed comparison: AcceptedExchange dark phone and EnlargedBlank dark desktop. Their authored bytes were unchanged, so they are not in the patch. The earlier 587 applied references were passing when selected; their prior review remains preserved, but the newly failed states are now disputed. No reference is silently refreshed to hide variance.

The documented final-run artifact download failed because Infisical/cache/bucket credentials are unavailable. The failed actual/diff images cannot be inspected locally. This is an unresolved evidence blocker, not a pass or an accepted baseline. No manual product QA or scores were used.
