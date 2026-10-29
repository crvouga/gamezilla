# ui-quality-check

Automatically score UI quality in screenshots and recorded test videos, entirely locally.

Run a pinned visual model over existing test artifacts and fail when a rendered state falls below your quality threshold. No cloud API, browser hooks, Python runtime, or test-framework integration.

A private workspace package: it is not published, and like the rest of this repository it is proprietary (repository [`LICENSE`](../../LICENSE); third-party notices in [`NOTICE.md`](NOTICE.md)). The commands below show its standalone interface.

```bash
npm install --save-dev ui-quality-check
npx ui-quality-check setup
npx ui-quality-check video test.webm
```

```ts
import { assertVideoQuality } from 'ui-quality-check';

await assertVideoQuality('test.webm');
```

**The initial UIClip detector is experimental.** It provides a useful quality signal but misses many clear defects. The controlled evaluation detected 42/96 defective screenshots and flagged 1/8 valid screenshots at its calibrated threshold. Scores are relative model preferences, not probabilities of correctness. Read [EVALUATION.md](EVALUATION.md), calibrate on your own UI, and retain behavioral and accessibility checks.

On an Apple M2 Max, a ten-minute corpus of mostly static recordings took **3.43 seconds**, including initialization. Dynamic recordings cost more: disabling deduplication took 27.86 seconds. Measurements and runtime comparisons are in [BENCHMARKS.md](BENCHMARKS.md).

UIClip reuses embeddings for identical preprocessed image windows within one checker. The cache retains at most 8,192 embeddings (16 MiB of embedding data), is cleared on disposal, and preserves each window’s contribution in the original order. Changed pixels still require inference.

## Offline setup

Node 22+ and Bun are supported. Installation supplies native ONNX Runtime, Sharp, and FFmpeg. Explicit setup downloads one pinned 605 MB checkpoint, verifies its SHA256, and prepares a 351 MB vision encoder in `~/.cache/ui-quality-check/<model-version>`. Check commands never download models or access remote media.

```bash
ui-quality-check setup --model-dir .cache/ui-model
ui-quality-check check reports --model-dir .cache/ui-model
```

For a disconnected machine, copy the prepared model directory or provide the official checkpoint locally:

```bash
ui-quality-check setup --source-path model.safetensors --model-dir .cache/ui-model
```

```ts
import { setup } from 'ui-quality-check';
await setup({ modelDir: '.cache/ui-model', sourcePath: 'model.safetensors' });
```

Setup is idempotent and repairs corrupt installations. Missing/corrupt models during a check produce a tooling error. Model revisions, hashes, preparation, licensing, and numerical parity are documented in [MODEL.md](MODEL.md). Reserve about 1 GB of RAM for setup and about 650 MB for typical accelerated checks on the measured machine. Native dependencies add their own installation size. If your package manager blocks installation scripts, approve `ffmpeg-static` and `onnxruntime-node` and rebuild them. Recent npm versions expose `npm approve-scripts`; Bun uses trusted dependencies. Alternatively supply an installed FFmpeg via `ffmpegPath`/`--ffmpeg`.

## API

```ts
import {
  checkImage, checkImages, checkVideo, checkVideos,
  assertImageQuality, assertImagesQuality,
  assertVideoQuality, assertVideosQuality,
  createUIQualityChecker,
} from 'ui-quality-check';

await assertImageQuality('screen.png', { threshold: 0.63 });
const batch = await checkVideos(['a.webm', 'b.mp4'], { threshold: 0.63 });
if (!batch.pass) throw new Error(batch.summary);

const checker = await createUIQualityChecker({
  threshold: 0.63, concurrency: 2, batchSize: 32,
});
try {
  await checker.checkVideo('a.webm');
  await checker.checkVideo('b.mp4');
  await checker.checkImages(['desktop.png', 'mobile.jpg']);
  await checker.check(['reports']); // recursively discover supported media
} finally {
  await checker.dispose();
}
```

Screenshot inputs accept a path, encoded PNG/JPEG `Uint8Array`, or `{ data, width, height }` with RGB bytes. Video inputs are local `.webm`/`.mp4` paths. Batch APIs preserve caller order; directory discovery uses deterministic path order. All detectors are required: overall pass requires every detector to pass. Assertions throw `UIQualityError` with the full result attached; tooling/configuration errors are separate exceptions.

Configuration-free convenience calls share one initialized checker. Use an explicit checker to reuse a configured model; configured convenience calls initialize/dispose their own checker. `disposeDefaultChecker()` releases the shared default. Disposal waits for already-started work and rejects later calls. `signal: AbortSignal` cancels decoding and checks between inference batches; an already-running native inference kernel completes before cleanup.

## CLI

```bash
ui-quality-check image screen.png
ui-quality-check video test.webm --threshold 0.63
ui-quality-check video 'reports/**/*.webm' --json
ui-quality-check check reports --config ui-quality.json
ui-quality-check reports --artifacts .cache/ui-quality --failure-clip-ms 1000
ui-quality-check benchmark sample-videos --json
```

Directories recursively discover `.webm`, `.mp4`, `.png`, `.jpg`, and `.jpeg`. Quote glob patterns; `*`, `**`, and `?` are supported. Paths beginning with a dash can follow `--`. `--help --json` lists options. Exit codes: **0** all pass, **1** quality failure, **2** tooling/configuration failure. SIGINT/SIGTERM abort checks and clean up decoders.

All commands support `--json`. Check commands consistently return a batch envelope, including for one input:

```json
{
  "schemaVersion": 1,
  "pass": false,
  "summary": "1 of 1 inputs failed UI quality.",
  "results": [{
    "schemaVersion": 1,
    "kind": "video",
    "input": "/absolute/test.webm",
    "pass": false,
    "score": 0.31,
    "worstScore": 0.31,
    "threshold": 0.63,
    "thresholdSource": "explicit",
    "durationMs": 10200,
    "framesAnalyzed": 42,
    "worstFrames": [{ "timestampMs": 7433, "quality": 0.31 }]
  }]
}
```

The example omits auxiliary fields. Results also include detector identity/version/provider, candidate/excluded/deduplicated counts, every inspected candidate's score, `failures`, and optional artifact paths. Reused candidate scores carry `reused: true`. Tooling errors return `{ "schemaVersion": 1, "error": { "kind": "tooling", "message": "..." } }`. Quality results exclude elapsed timings, dates, and memory statistics; benchmark output measures these separately.

## Calibrate a threshold

The configuration-free **0.5** threshold is only the neutral boundary between the two model prompts. It is deliberately labeled `experimental`; it has no universal empirical justification. No strict/balanced/lenient presets are supplied.

```bash
ui-quality-check calibrate --good examples/good --bad examples/bad \
  --max-false-positive-rate 0.01 --output ui-quality.json --json
ui-quality-check check reports --config ui-quality.json
```

Calibration scores both labeled sets, shows distributions and candidate thresholds, and reports confusion counts, precision, recall, false-positive rate, and false-negative rate. It chooses maximum measured recall within the false-positive budget, breaking ties toward fewer false positives and a lower threshold. The default budget is 5%. If there is no useful separation, it returns no recommendation/configuration and exits 2. A small corpus cannot establish a low real-world error rate; validate the proposed threshold on additional examples.

```ts
import { calibrate, createUIQualityChecker } from 'ui-quality-check';
const report = await calibrate({
  good: ['good.png'], bad: ['broken.png'],
  maxFalsePositiveRate: 0.01,
});
if (!report.configuration) throw new Error('No useful threshold found');
const checker = await createUIQualityChecker(report.configuration);
try { await checker.checkVideo('test.webm'); }
finally { await checker.dispose(); }
```

Generated JSON records threshold, model/version, execution provider, detector versions, aggregation, and calibration date. Applying it refuses a changed detector/provider instead of silently using an incompatible calibration. Pin the provider, package, decoder and model versions in CI; different hardware/providers can differ numerically near a threshold. `calibrationStatistics(goodScores, badScores)` evaluates already-scored datasets without loading a model.

## Sampling, aggregation, and exclusions

FFmpeg streams RGB frames through pipes. It selects the first available source frame in each fixed **4 FPS** timestamp bucket, retains actual source timestamps, and bounds the decode resolution to 1024 pixels on the longest side. Decoding compressed video still requires reading intermediate source frames. Only a bounded frame batch is retained; no temporary screenshots are written.

A 64×64 RGB fingerprint compares each candidate with the last inferred frame. Mean difference must be at most **0.004**, and the largest 8×8 tile difference must be at most four times that tolerance, to reuse a score. Comparing against the inferred anchor preserves accumulated changes. `dedupeThreshold: 0` disables this optimization. Inference uses one serialized model shared by concurrent decoders; default decoder concurrency is **2**, frame batch size **16**, and internal window batches are **16 on CPU / 32 on GPU**. An explicit `batchSize` overrides both batch limits.

`aggregation: 'minimum'` is the default: one low inspected score fails. `aggregation: 'confirmed'` instead takes the minimum of adjacent candidate-pair maximum scores within **750 ms**, requiring nearby low candidates. Reused candidates count, so a persistent defective static state can fail after one inference. With fewer than two candidates or no eligible pairs, it falls back to minimum. `worstScore` always reports the raw minimum; a passing confirmed result has no failures. Confirmed aggregation can hide a brief real defect; evaluate this tradeoff before choosing it.

Uniform neutral black/white leading and trailing frames are excluded by default: RGB range ≤2 and intensity ≤3 or ≥252. A matching blank frame between rendered UI states gets deterministic `empty-ui` failure evidence. A wholly blank/excluded recording is a tooling error, never a pass. `ignoreEmptyFrames: false` / `--include-empty` disables the heuristic. Sparse loading screens and colored splash screens are scored normally. Intentional interior blank transitions need a justified explicit exclusion:

```ts
{ ignoreRegions: [{ startMs: 0, endMs: 400 }], samplingFps: 8 }
```

Intervals are start-inclusive/end-exclusive and reported in the counts. There is no automatic loading-screen suppression, overlay masking, aesthetic policy, or browser instrumentation. Sampling can miss defects shorter than its interval, and thumbnail deduplication can miss very small local changes. This version does not detect timing stutters, flicker, or frozen animations.

## Diagnostics and caching

```ts
{ artifactsDir: '.cache/ui-quality', failureClipMs: 1000, maxWorstFrames: 3 }
```

Artifacts use `<input-name>-<path-hash>/result.json`, full-resolution `worst-<seconds>.png`, and optional one-second `context-<seconds>.mp4`. Only failing, independently scored frames are extracted. Passing inputs can still emit result JSON. A model score explains where to look; it does not identify a particular overlapping element or provide a semantic defect diagnosis.

`cacheDir` enables an optional SHA256 result cache keyed by media content, package/model/provider versions, preprocessing, sampling, decoder version, and resolved configuration. Cached evidence is checksummed; corrupt entries are recomputed. Requested artifacts are regenerated from the original input. A cache hit still initializes/verifies the shared model. Inputs and result paths are absolute; portable CI caches should use consistent workspace paths. Benchmarks disable the result/artifact cache to measure actual processing.

## Pipeline integration

Run this after any existing system has produced screenshots/videos. The package has no dependency on that system.

```json
{
  "scripts": {
    "check:ui-quality": "ui-quality-check check .cache/test-reports --config ui-quality.json --json"
  }
}
```

Cache the prepared model directory during explicit CI setup, verify it with `ui-quality-check setup`, then run the gate with networking disabled if desired. For Turborepo, declare the recorded media and calibrated JSON as task inputs, generated result/artifact directories as outputs, and order this task after the artifact producer. The optional content cache also works outside a build system. No changes to scenarios or recording instrumentation are needed.

## Extending and developing

Provide `detectors: readonly QualityDetector[]` to replace or combine detectors. Each exposes `info`, `initialize()`, batched `score(RgbImage[], signal?)`, and `dispose()`. The checker validates one finite normalized score per image, requires every detector, and preserves per-detector evidence. `executionProviderCandidates()` exposes the portable candidate policy for custom native adapters; candidates still require successful initialization/inference. An injectable `VideoDecoder` supports other local media backends; its version participates in caching. `SequenceDetector` describes a future incremental temporal seam, but is not executed by the current checker.

The standalone ESM build bundles its generic utility code, with exactly three runtime dependencies: ONNX Runtime, Sharp, and FFmpeg. It imports no application, spec, harness, browser, or test-runner package. Core logic receives I/O ports; process/filesystem/clock adapters are wired at standalone composition roots.

From this package directory: `bun run tc`, `bun run lint`, `bun test`, `bun run build`. The fast tests use deterministic detectors, injected decoders and virtual clocks. `bun run evaluate` runs the real installed model offline over the committed 208-image corpus. `bun run scripts/generate-videos.ts` creates the benchmark corpus, `bun run scripts/profile.ts .cache/benchmark-videos` measures the tradeoffs, and `bun run scripts/verify-native.ts /path/to/node` performs automated real-codec/CLI/model assertions. These development commands never install a model implicitly.
