# Model provenance and runtime choice

The initial backend uses [UIClip's official human-pair checkpoint](https://huggingface.co/biglab/uiclip_jitteredwebsites-2-224-paraphrased_webpairs_humanpairs), whose model card declares MIT licensing. UIClip's purpose and evaluation are described by its authors in [UIClip: A Data-driven Model for Assessing User Interface Design](https://arxiv.org/abs/2404.12500). Its scores measure design preference and relevance conditioned on text; the normalized output here is not a calibrated probability of an acceptable UI.

## Pinned distribution

Upstream distributes a PyTorch safetensors checkpoint rather than a ready-to-run ONNX graph. This package bundles a small, prepared ONNX vision graph, source-tensor mapping, and two text embeddings. Consumers install only native JavaScript dependencies and use an explicit TypeScript setup command to prepare vision weights.

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| Official checkpoint, revision `505d4731b09263c07437a9022d23c800274da56b` | 605156676 | `cf8bcb4f3605ab11a64f9ed515ef96c65618071c67e4756921db66a7aebd1820` |
| Prepared vision weights | 351396864 | `3ca4556e6c7d23cdd8e0bd1995d2278e2ad544aa7e89defaa200ec1c5278b1b4` |
| Bundled ONNX graph | 188914 | `6e68e4b1bea189e543047d96fab38cf6b0755d3339925a07f3828c83dc35005d` |

The prepared model version is `<revision>-vision-caption-v1`; prompt or preprocessing changes require a new version. `assets/manifest.json` is the machine-readable manifest. Setup verifies the checkpoint before bytewise tensor extraction/transposition, verifies the resulting weights and bundled graph, then writes them atomically per file. Initialization streams both model files through SHA256; partial/corrupt installations fail without networking. Simultaneous identical setup operations can safely converge on the same verified bytes. Setup temporarily retains source and converted bytes in memory; typical checks load only the vision encoder.

The full source is fetched only by explicit `setup()` / `ui-quality-check setup`. There is no on-demand model download in inference or fallback. An existing valid installation is verified rather than downloaded again. Prepared model files are portable across providers; calibrated thresholds also pin their selected provider.

## Scoring contract

Input pixels become orientation-corrected, white-flattened sRGB. Sharp 0.35.5 performs a cubic resize with the short side at 224, preserving aspect ratio. Evenly spaced overlapping 224×224 windows cover the long side; an aspect-ratio budget caps it at 4096. This whole-screen coverage intentionally differs from upstream's floor-stepped sliding windows. RGB channels use CLIP's pinned mean `[0.48145466, 0.4578275, 0.40821073]` and standard deviation `[0.26862954, 0.26130258, 0.27577711]`.

The ViT-B/32 vision encoder projects each window to 512 dimensions. Window embeddings are summed and L2-normalized (equivalent to normalizing their mean). Two precomputed, normalized text embeddings use these exact prompts:

```text
ui screenshot. well-designed. a user interface.
ui screenshot. poor design. a user interface.
```

Scores are `softmax(100 × cosine(image, text))[well-designed]`, rounded to six decimal places. The tokenizer is pinned to `openai/clip-vit-base-patch32` revision `3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268`. Runtime never loads a tokenizer or text tower. No quantization was adopted without an accuracy evaluation.

ONNX Runtime 1.30.0 uses optimized FP32 graphs, sequential execution, one inter-op thread, and up to eight intra-op CPU threads. Automatic provider selection tries registered CUDA, WebGPU, DirectML and CPU in that order, requiring successful batched inference before selecting a provider. CUDA is registered with `bundled: false` because its separately installed library is not shipped inside the base package; that flag does not mean it is unavailable. This distinction follows the [native backend registry](https://github.com/microsoft/onnxruntime/blob/main/js/node/src/inference_session_wrap.cc). It reports the selected provider in every result. GPU availability alone is not sufficient. Core ML remains an explicit experiment because the dynamic graph failed its batched initialization on the measured machine.

Pin provider, batch size, media/decoder, model and package versions for CI reproducibility. Deterministic sampling/order and rounded scores are stable within the checked runtime; floating-point output can vary slightly across hardware and providers. These differences must not be hidden behind a claim of universal bitwise determinism.

## Reproducible preparation

`scripts/export-model.py` is development-only tooling, with dependency versions in its header. It accepts local checkpoint/tokenizer directories, exports an opset-17 dynamic-batch vision graph, maps every initializer to a pinned checkpoint tensor, and checks PyTorch/ONNX CPU output agreement. It never performs network requests and is not included in the consumer runtime.

```bash
python scripts/export-model.py CHECKPOINT_DIR TOKENIZER_DIR SCRATCH_OUTPUT_DIR
```

Reproduction yielded the exact graph and weight hashes above. For two deterministic 224×224 tensor inputs, maximum absolute embedding error against PyTorch was **0.00000667572021484375**, below the enforced 0.00003 bound. The manifest and all model outputs should be reviewed together when preparing a replacement model. This numerical parity establishes conversion correctness; [EVALUATION.md](EVALUATION.md) measures defect discrimination separately.

## Runtime evaluation

We evaluated direct [ONNX Runtime Node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html), local-only [Transformers.js](https://huggingface.co/docs/transformers.js/en/guides/node), and the [Core ML execution provider](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html). Direct ONNX Runtime supports native GPU batching with a small API and explicit local files. Transformers.js adds an unnecessary model/tokenizer layer for this fixed vision graph and offers no accuracy advantage. Core ML's tested dynamic model did not support practical batched execution; a static batch-one model had a roughly 191-second cold compile despite fast warm inference. A bespoke Swift/Core ML bridge would add platform-specific packaging, while direct WebGPU already delivered strong Apple Silicon throughput.

The selected path is therefore native ONNX Runtime, automatically accelerated when supported, with portable CPU fallback. There is no Python, PyTorch, MPS bridge or separate GPU model process in the installed package. Detailed measured startup/batch/throughput tradeoffs are in [BENCHMARKS.md](BENCHMARKS.md).
