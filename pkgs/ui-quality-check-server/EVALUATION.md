# Detector evaluation

UIClip has measurable preference signal, but its screenshot-level scores are insufficient to catch every visually broken UI. The current detector should be treated as an experimental, project-calibrated signal.

## Corpus and method

There are **16 known-good** screenshots and **192 known-bad** screenshots, with every byte hash pinned in `fixtures/corpus.json`. Eight layout families cover desktop, mobile, modal dialogs, chessboards, intentionally dense tables, loading, wrapped text, and compact screens. Twelve controlled mutations create overlap, clipping, broken wrapping, crowding, malformed spacing, offscreen dialogs, cut-off controls, giant text, responsive overflow, duplicated elements, unexpected empty regions, and alignment defects.

Labels derive from the controlled constructions; no human click-through or manual visual verification supplied test evidence. The source generator is `scripts/fixture-ui.ts` / `scripts/generate-fixtures.ts`. Committed raster files make scoring independent of font rendering on the evaluation machine.

The calibration split contains 8 good and 96 bad screenshots. The evaluation split contains 8 good and 96 bad screenshots with changed chrome/background, retaining the same layout families and mutations. **This is a small synthetic variant split, not an independent real-world holdout.** Class balance and labels do not estimate a production test suite's prevalence or false-alarm rate. Some mutations are mild; catastrophic clipping and offscreen states are nevertheless missed.

`bun run evaluate` checks fixture hashes and runs actual local inference, using UIClip revision `505d4731b09263c07437a9022d23c800274da56b-vision-caption-v1`, WebGPU, batch size 32. Complete scores and distributions are in `fixtures/evaluation.json`.

## Measured results

Calibration maximizes recall while permitting at most 5% observed good-image failures. With only eight good samples that permits zero failures. It suggested **0.534143**; this is a corpus-specific candidate, not the package default or a recommendation for another UI.

| Metric | Calibration | Evaluation |
| --- | ---: | ---: |
| Known-good | 8 | 8 |
| Known-bad | 96 | 96 |
| True positives | 45 | 42 |
| False positives | 0 | 1 |
| True negatives | 8 | 7 |
| False negatives | 51 | 54 |
| Precision | 100% | 97.67% |
| Recall | 46.88% | 43.75% |
| False-positive rate | 0% | 12.50% |
| False-negative rate | 53.13% | 56.25% |

The clean modal dialog was the false positive; its evaluation score 0.532185 narrowly falls below the proposed threshold. The unusual-but-valid chessboard passed at 0.672146, dense table at 0.719889, and loading screen at 0.696348. These are individual examples, not evidence that all game/loading UIs are safe from false positives.

The model ranked the paired good layout above its mutation for **86.98%** of all 192 pairs. Good-vs-bad relative ranking is stronger than absolute threshold separation.

| Evaluation defect | Detected / 8 |
| --- | ---: |
| Overlap | 4 |
| Clipping | 2 |
| Broken wrapping | 6 |
| Crowding | 4 |
| Malformed spacing | 1 |
| Offscreen dialog | 2 |
| Cut-off controls | 2 |
| Giant text | 4 |
| Responsive overflow | 2 |
| Duplicated elements | 8 |
| Empty regions | 2 |
| Alignment | 5 |

Do not use a green score as proof that catastrophic jank was absent. Missed clipping, cut-off controls and offscreen dialogs are particularly concerning. Increasing a threshold improves recall at the expense of false positives, and repeated videos multiply opportunities for a false alarm. Evaluate whole recordings as well as individual screenshots before enabling a CI gate.

## Detector choice and next work

The [upstream model](https://huggingface.co/biglab/uiclip_jitteredwebsites-2-224-paraphrased_webpairs_humanpairs) assesses design preference given a textual description; it was not trained as a universal defect classifier. This implementation uses a fixed generic interface description to avoid a costly text tower and user configuration. That adaptation requires independent validation.

Development comparisons included upstream base/web-pair variants, generic prompt variants, mean embeddings versus minimum-window aggregation, and inexpensive frame fingerprints. None demonstrated enough catastrophic-defect recall to justify stronger claims or invented strict/balanced/lenient presets. A single fixed generic prompt pair and mean image embedding keep the initial detector understandable. Alternative caption experiments used PIL resizing and are exploratory; reported package metrics use the pinned Sharp preprocessing.

The next meaningful accuracy improvement requires an independently labeled real screenshot/video corpus and a more appropriate classifier or deterministic detector. The existing `QualityDetector` seam permits replacing UIClip without changing the checking/decoding/reporting API. No product-specific tuning, synthetic-corpus-trained replacement, or suppression system was added to inflate this evaluation.
