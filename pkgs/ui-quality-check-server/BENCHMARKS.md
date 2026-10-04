# Local performance measurements

Measured on 2026-10-02: Apple M2 Max, 12 CPU cores, 30 GPU cores, 32 GiB unified memory, macOS 26.6.2. Package pipeline measurements used Bun 1.4.2, ONNX Runtime Node 1.30.0, Sharp 0.35.5 and FFmpeg 6.1.1. Isolated runtime comparisons used Node 22.22.3. These are workstation measurements, not a guarantee for every device, codec, resolution or recording.

## Whole-video pipeline

The generated corpus comprises twelve 50-second recordings at 30 FPS: six H.264 MP4 and six VP9 WebM, totaling **600 seconds**. It uses eight screenshot families, including chess, mobile, dense tables and loading. Each recording shows a good state, a one-second duplicated-elements defect, then the good state again. It represents mostly static test recordings with meaningful transitions; it does not represent continuous motion or rapidly changing games.

The final sequential configuration sweep produced:

| Configuration | Candidate frames | Model frames | Startup | Total | Faster than real time |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default: WebGPU, batch 16, 4 FPS, 2 decoders | 2400 | 36 | 0.792 s | **3.426 s** | **175×** |
| Batch 1 | 2400 | 36 | 0.463 s | 3.975 s | 151× |
| Batch 32 | 2400 | 36 | 0.628 s | 3.635 s | 165× |
| 2 FPS | 1200 | 36 | 0.682 s | 5.488 s | 109× |
| 8 FPS | 4800 | 36 | 1.024 s | 4.989 s | 120× |
| Deduplication disabled | 2400 | 2400 | 0.458 s | 27.857 s | 21.5× |
| One decoder | 2400 | 36 | 0.441 s | 5.527 s | 109× |
| Four decoders | 2400 | 36 | 0.519 s | 2.453 s | 245× |
| CPU, up to 8 threads | 2400 | 36 | 0.556 s | 4.938 s | 122× |

Default scoring consumed 429 ms of native inference for 90 image windows: **209.8 windows/second**. End-to-end throughput was **210.2 videos/minute**, including initialization. Parent peak RSS was **627 MiB**, and parent CPU time averaged **85% of one core**. FFmpeg child CPU and memory are excluded from these process metrics. Model frames and windows differ: a rectangular screenshot requires multiple 224×224 crops.

Deduplication removed 98.5% of candidates and was the largest saving. Even with every candidate inferred, the complete corpus took less than half a minute; this provides a useful lower bound on the gain for this corpus when frames change constantly, not a benchmark of realistic continuous-motion video.

Batch-one native inference took 1699 ms versus 429 ms by default. Larger frame batches provided little gain when each recording contained only three unique states; the isolated window benchmark below shows why larger inference batches matter for dynamic inputs. Four concurrent decoders were faster on this machine, but two remains the conservative default for smaller CI machines and large videos.

Sampling counts change exactly with FPS; sensitivity does not: the same one-second defects were retained at 2, 4 and 8 FPS. This does not measure sub-250-ms defect recall. Lower FPS can miss brief failures and higher FPS cannot fix the model's screenshot classification misses.

The timings include warm filesystem/driver state and other workstation activity. In an earlier sweep, 2 FPS took 2.397 s, while the final sweep's 2 FPS run spent 4.806 s in processing. This variability prevents claiming that reducing FPS alone always improves elapsed time. Throughput comparisons that matter should be repeated on the target runner. `fixtures/benchmark.json` retains the final sweep and measurement definitions; peak RSS after the first configuration is cumulative for the entire sweep process.

## CPU/GPU utilization

The portable `benchmark` command reports parent CPU utilization and marks GPU utilization unavailable (`null`); Node does not expose a portable GPU occupancy metric. An optional macOS `scripts/profile-gpu.ts` sampler measured device-global utilization every 250 ms using `ioreg`. Its separate default run took 3.976 s, initialized in 750 ms, peaked at 639 MiB parent RSS, and used 74.2% parent CPU. Fourteen GPU samples averaged **36.6%**, with a maximum of **84%**.

Those readings include other device users, depend on the driver's averaging window, and add profiler overhead. They are not process-attributed GPU occupancy or aggregate CPU use. The raw readings and scope are in `fixtures/benchmark.json`. No GPU utilization numbers were invented for Linux/Windows or inferred from frame throughput.

## Runtime candidates

Each isolated inference benchmark initializes a local FP32 vision graph, warms each batch, then measures three runs. It excludes decoding, screenshot preprocessing, model checksum verification and scoring-head work. CPU and WebGPU used direct native ONNX Runtime 1.30.0 with eight CPU threads. Transformers.js 3.8.1 used its own local CPU runtime and offline model loader; its dependency/runtime allocation differs from direct ONNX Runtime, so memory differences cannot be attributed solely to wrapper code.

| Runtime | Startup | Batch 1 windows/s | Batch 4 | Batch 16 | Batch 32 | Observed RSS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct ONNX CPU | 327 ms | 45.2 | 46.6 | 53.7 | 57.1 | 441–564 MiB |
| Direct ONNX WebGPU | 419 ms | 62.4 | 181.2 | 257.7 | **272.4** | 732–780 MiB |
| Transformers.js CPU | 385 ms | 34.2 | 36.2 | 42.7 | 49.5 | 788–828 MiB |

The Core ML dynamic-batch MLProgram graph failed execution-plan creation on this machine. Its legacy neural-network path initialized in roughly 5 seconds, managed about 2.75 batch-one windows/s, and failed at batch four. A separately exported static batch-one MLProgram initialized in **190.75 seconds** and then achieved roughly 148 windows/s. That long cold compilation and lack of practical dynamic batching made it unsuitable as the normal CI path. It is excluded from automatic selection; explicit experimentation remains possible. No platform-specific Swift bridge was shipped.

Direct native ONNX Runtime offers the best measured combination of portability, low startup cost and accelerated batching. Node/Bun consumers need neither Python nor Transformers.js. Core ML support in the runtime does not establish suitability for this particular exported graph.

## Repeated screenshot windows

An automated CPU comparison on 2026-10-03 used 1,024 failure screenshots retained by Check workflow `5976qtddpb` (head `4a1389d2bc`). It selected every sixth filename from the sorted failure PNGs, then compared the original detector with bounded window-embedding reuse, using one checker per implementation, the same pinned model, batch size 16, and threshold 0.5. Decoding and scoring took **83.084 seconds before and 47.144 seconds after** (43.3% less time); initialization is excluded. Native inference fell from 78.379 to 42.010 seconds, with 3,072 versus 1,799 inferred windows. All 1,024 scores and verdicts were exactly equal. This workstation measurement includes other local activity and uses failed screenshots only; it does not establish a complete CI duration or detector accuracy. The window cache retains at most 8,192 embeddings and is cleared on disposal.

## Reproduce

Run explicit model setup first. From the package source directory:

```bash
bun run scripts/generate-videos.ts
bun run scripts/profile.ts .cache/benchmark-videos
bun run scripts/profile-gpu.ts .cache/benchmark-videos # optional macOS sampler
ui-quality-check benchmark .cache/benchmark-videos --json
ui-quality-check benchmark .cache/benchmark-videos --provider cpu --json
ui-quality-check benchmark .cache/benchmark-videos --dedupe-threshold 0 --json
```

For deployed runners, benchmark actual recordings, include both static and animated cases, and retain candidate/unique counts alongside elapsed time. Cache prepared models, reuse one checker, and choose concurrency/batches from measured memory and throughput. Results on Linux CPU, CUDA and Windows DirectML hardware have not been measured here; their automatic candidate/fallback logic is covered, while numerical accuracy and throughput require hardware-specific evaluation.
